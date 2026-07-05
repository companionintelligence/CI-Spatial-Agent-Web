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


def _is_clothing_mesh(mesh):
    """A clothing/footwear mesh carries HumGen's ``Body Proportions`` fit shape key
    and no face-contract morphs. The custom-property tags (set by HumGen) are the
    authoritative signal; the shape-key name is a fallback."""
    if 'cloth' in mesh or 'shoe' in mesh:  # HumGen tags survive the rig swap
        return True
    sk = mesh.data.shape_keys
    if sk is None:
        return False
    names = {kb.name for kb in sk.key_blocks}
    has_fit = 'Body Proportions' in names
    has_contract = any(n.startswith('viseme_') for n in names)
    return has_fit and not has_contract


def flatten_clothing_shapekeys(mesh):
    """Bake a clothing mesh's active shape-key MIX into its geometry, then drop all
    shape keys.

    HumGen fits each garment to the specific body via a ``Body Proportions`` shape
    key held at value=1 (plus muted pose correctives). If those shape keys are
    simply pruned, the garment snaps back to its generic Basis and clips into the
    body — e.g. the sweater sank into the chest, exposing dark geometry underneath
    (the black blobs). ``shape_key_remove(all=True, apply_mix=True)`` applies the
    current mix (the fitted shape) into the vertices before removing the keys, so
    the exported garment keeps its body-fitted shape and carries no morph targets
    (clothing needs none).
    """
    _require_bpy()
    sk = mesh.data.shape_keys
    if sk is None:
        return 0
    n = len(sk.key_blocks)
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    try:
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
        # The garment ships with CUSTOM SPLIT NORMALS authored for its ORIGINAL
        # (un-fitted) geometry. apply_mix moved the vertices to the fitted shape but
        # left those custom normals stale, so large areas rendered black (normals
        # pointing the wrong way). Clear them and recompute smooth normals from the
        # now-correct geometry — the tangent-space normal-map still adds surface
        # detail on top.
        if mesh.data.has_custom_normals:
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
        _shade_smooth(mesh)
        print(f'[glb_export] flattened {n} shape keys into {mesh.name} '
              f'(baked Body-Proportions fit, cleared stale custom normals)')
    except RuntimeError as e:
        print(f'[glb_export] could not flatten {mesh.name} shape keys ({e})')
    return n


def _shade_smooth(mesh):
    """Set smooth shading on all polygons so recomputed normals interpolate."""
    for poly in mesh.data.polygons:
        poly.use_smooth = True


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

    # 1. Shape-key cleanup FIRST — these ops (flatten uses shape_key_remove) mutate
    #    the active object + selection, so they must run BEFORE we build the export
    #    selection or they'd clobber it (which silently dropped body+bones+morphs).
    if armature is not None:
        for child in list(armature.children):
            if child.type != 'MESH':
                continue
            # Clothing: bake the Body-Proportions fit into geometry and drop all
            # shape keys (garments carry no contract morphs). Body/face meshes:
            # keep only the viseme/ARKit contract morphs.
            if _is_clothing_mesh(child):
                flatten_clothing_shapekeys(child)
            elif prune_morphs:
                prune_noncontract_morphs(child)

    # 2. NOW build the export selection: the armature + all its skinned meshes.
    bpy.ops.object.select_all(action='DESELECT')
    if armature is not None:
        armature.select_set(True)
        for child in armature.children:
            child.select_set(True)
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
