"""GLB export step — write a web/XR-ready ``.glb`` satisfying the rig contract.

Uses Blender's bundled glTF2 exporter (the patched exporter in DRIVE-ASSETS.md
is only needed for edge cases; the stock one exports morph targets + skin fine
on 4.5). Morph target names MUST survive export — the exporter writes them to
``mesh.extras.targetNames``, which is what the app's GLTFLoader reads.
"""

import os

try:
    import bpy
except ImportError:
    bpy = None

# Shape keys we always keep on export: the face-morph contract. Anything not in
# this set and not a "face" morph (eye/brow/mouth/nose/cheek/jaw/viseme) is a
# body corrective / live key that only bloats the GLB, so prune_noncontract_morphs
# drops it. Kept in sync with mappings.OCULUS_VISEMES + ARKIT_MORPHS.
_FACE_MORPH_HINTS = ('viseme_', 'eye', 'brow', 'mouth', 'nose', 'cheek', 'jaw', 'tongue')


def _require_bpy():
    if bpy is None:
        raise RuntimeError('glb_export.py must run inside Blender (bpy unavailable)')


def prune_noncontract_morphs(mesh):
    """Remove body-corrective / live-key shape keys that aren't face morphs.

    HumGen leaves ~30 non-face shape keys on the body (``cor_*`` posture
    correctives, ``LIVE_KEY_*``, the gender morph ``Male``/``Female``, etc.). Each
    morph target stores a full-mesh position delta, so on a 25 k-vert body they
    dominate the GLB size. We keep only the contract face morphs (visemes + ARKit)
    and drop the rest, shrinking the export several-fold without touching geometry
    or the Basis. Shape keys are removed in reverse order so indices stay valid.
    """
    _require_bpy()
    sk = mesh.data.shape_keys
    if sk is None:
        return 0
    keep_lower = tuple(h.lower() for h in _FACE_MORPH_HINTS)
    removed = 0
    for kb in reversed(list(sk.key_blocks)):
        if kb == kb.relative_key and kb.name == 'Basis':
            continue  # never remove Basis
        name = kb.name
        low = name.lower()
        is_face = low.startswith('viseme_') or any(h in low for h in keep_lower)
        if not is_face:
            mesh.shape_key_remove(kb)
            removed += 1
    print(f'[glb_export] pruned {removed} non-contract shape keys from {mesh.name}')
    return removed


def bake_textures(human, folder, samples=4):
    """Bake HumGen's procedural skin to image textures BEFORE export.

    VERIFIED against HumGen3D v4.0.29 source: ``ExportBuilder._export_common_gltf``
    warns "Exporting GLTF without baking textures. This will result in empty
    textures" and unlinks all skin textures if ``human.process.baking.is_baked()``
    is False. Since Strategy D re-skins onto the RPM armature (so we export via the
    raw glTF exporter, not ``human.export``), we must bake here first. HumGen's
    baker lives at ``human.process.baking``; SimpleBake (owned, see DRIVE-ASSETS.md)
    is the fallback for finer control.

    The v4.0.29 API is ``baking.bake_all(folder_path, samples=4, context=None)`` —
    it writes body/eyes/teeth PBR PNGs (base color, normal, roughness, specular)
    into ``folder`` and relinks them onto the materials. NB: do NOT use
    ``human.export.to_glb(..., bake_textures=True)`` — that convenience path is
    broken in 4.0.29 (``HumGen3D.common.os`` shadows stdlib ``os`` and lacks
    ``.path``, so the decorator's ``os.path.dirname`` throws). Bake here, then
    export with the raw glTF exporter (or ``bake_textures=False``).

    Args:
        human: the HumGen ``Human`` instance.
        folder: directory to write the baked PNGs into (usually the GLB's dir).
        samples: bake samples (HumGen default 4).
    """
    _require_bpy()
    baking = getattr(getattr(human, 'process', None), 'baking', None)
    if baking is None:
        print('[glb_export] WARNING: no HumGen baking API found — textures may be empty. '
              'Bake manually (HumGen or SimpleBake) before export.')
        return False
    try:
        if not baking.is_baked():
            os.makedirs(folder, exist_ok=True)
            baking.bake_all(folder, samples)  # VERIFIED v4.0.29 signature
        return True
    except Exception as e:  # noqa: BLE001
        print(f'[glb_export] texture bake failed ({e}); export may have empty textures')
        return False


def export_glb(out_path, armature=None, prune_morphs=True):
    """Export the current scene selection to ``out_path`` (.glb, +Z forward).

    The GLB path in the app uses forward = +Z, so we export in Blender's default
    orientation (the RPM T-pose was authored that way). We DO NOT bake in body
    animations — those stay the shared RPM clip library.

    ``prune_morphs`` drops non-face shape keys (body correctives / live keys) from
    the skinned meshes first, which shrinks the GLB several-fold.
    """
    _require_bpy()
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)

    # Select the armature + its skinned meshes so the export scopes to the avatar.
    bpy.ops.object.select_all(action='DESELECT')
    if armature is not None:
        armature.select_set(True)
        for child in armature.children:
            child.select_set(True)
            if prune_morphs and child.type == 'MESH':
                prune_noncontract_morphs(child)
        bpy.context.view_layer.objects.active = armature

    # TODO: verify export flags on installed 4.5 glTF2 exporter. Key options:
    #   export_morph=True                 -> keep shape keys as morph targets
    #   export_morph_normal=True          -> smoother morph deformation
    #   export_skins=True                 -> keep the RPM armature skin
    #   export_yup=True                   -> glTF +Y up convention
    #   use_selection=True                -> only the selected avatar
    #   export_apply=False                -> KEEP modifiers unapplied? No — apply
    #                                        so the Armature modifier bakes; but
    #                                        apply=True destroys shape keys, so we
    #                                        rely on export_morph instead and keep
    #                                        modifiers live.
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        use_selection=(armature is not None),
        export_yup=True,
        export_morph=True,
        export_morph_normal=False,        # position-only deltas — halves morph size
        export_skins=True,
        export_animations=False,          # body anims live in the shared clip lib
        export_apply=False,               # preserve shape keys (morph targets)
    )
    size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f'[glb_export] wrote {out_path} ({size_mb:.1f} MB)')
    return out_path
