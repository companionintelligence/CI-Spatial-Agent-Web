"""Face-morph step — rename/bind HumGen shape keys to the app's morph names.

The rig contract needs two families of morphs on the body mesh:

  * 15 Oculus visemes, prefixed ``viseme_`` (GLB lip-sync collector keys on the
    prefix — it is mandatory).
  * the ARKit-52 facial blendshapes (GLB emote collector keeps any morph whose
    name includes eye/brow/mouth/nose/cheek/jaw).

HumGen ships a FACS-oriented shape-key set whose names do NOT match these. This
module renames the ones that map 1:1 and creates zero-filled placeholder morphs
for any contract name with no HumGen source, so the export still validates.

The HumGen->app source names live in mappings.py and are flagged NEEDS
VERIFICATION — author the real table by dumping the installed mesh's shape keys.
"""

try:
    import bpy
except ImportError:
    bpy = None

from mappings import (  # noqa: E402
    HUMGEN_TO_OCULUS_VISEME,
    HUMGEN_TO_ARKIT,
    OCULUS_VISEMES,
    ARKIT_CONTRACT_MORPHS,
)


def _require_bpy():
    if bpy is None:
        raise RuntimeError('facemorphs.py must run inside Blender (bpy unavailable)')


def _key_blocks(mesh):
    sk = mesh.data.shape_keys
    if sk is None:
        # ensure a Basis exists so we can add relative shape keys
        mesh.shape_key_add(name='Basis', from_mix=False)
        sk = mesh.data.shape_keys
    return sk.key_blocks


def dump_shape_keys(mesh):
    """Return the current shape-key names — use this to author the real maps."""
    _require_bpy()
    if mesh.data.shape_keys is None:
        return []
    return [kb.name for kb in mesh.data.shape_keys.key_blocks]


def _rename_present(mesh, src_to_dst):
    """Rename shape keys src->dst where src exists. Returns dst names created."""
    blocks = _key_blocks(mesh)
    by_name = {kb.name: kb for kb in blocks}
    created = []
    for src, dst in src_to_dst.items():
        if dst is None:
            continue
        kb = by_name.get(src)
        if kb is not None and kb.name != dst:
            kb.name = dst
            created.append(dst)
        elif dst in by_name:
            created.append(dst)  # already correctly named
    return created


def _ensure_placeholder(mesh, name):
    """Create a zeroed (Basis-copy) shape key so a required morph name exists."""
    blocks = _key_blocks(mesh)
    if name in {kb.name for kb in blocks}:
        return False
    # from_mix=False copies the Basis, giving a no-op morph that satisfies the
    # name contract without deforming. Real deformation comes from a verified
    # HumGen source key once HUMGEN_TO_* is authored.
    mesh.shape_key_add(name=name, from_mix=False)
    return True


def bind_visemes(mesh):
    """Rename/synthesize the 15 Oculus ``viseme_*`` morphs on ``mesh``."""
    _require_bpy()
    _rename_present(mesh, HUMGEN_TO_OCULUS_VISEME)
    added = [v for v in OCULUS_VISEMES if _ensure_placeholder(mesh, v)]
    if added:
        print(f'[facemorphs] placeholder visemes (NEEDS real HumGen source): {added}')
    return OCULUS_VISEMES


def bind_arkit(mesh, human=None):
    """Generate the ARKit blendshapes on ``mesh``.

    VERIFIED against HumGen3D v4.0.29 source: HumGen ships a built-in operator
    ``hg3d.prepare_for_arkit`` (human/expression/operators.py) that converts its
    FACS shape keys into the standard ARKit blendshape set. ``suffix='long'`` =
    "Left and Right (Default ARKit)", which yields the app's contract names
    (eyeBlinkLeft/Right, jawOpen, browInnerUp, mouthSmile*, …) directly — so the
    hand-authored HUMGEN_TO_ARKIT rename table is NOT needed. This is the primary
    path; the rename+placeholder fallback only runs if the operator is unavailable.
    """
    _require_bpy()
    try:
        bpy.context.view_layer.objects.active = getattr(human, 'body_obj', None) or mesh
        bpy.ops.hg3d.prepare_for_arkit(suffix='long')  # VERIFIED v4.0.29
        present = {kb.name for kb in _key_blocks(mesh)}
        missing = [m for m in ARKIT_CONTRACT_MORPHS if m not in present]
        for m in missing:
            _ensure_placeholder(mesh, m)
        if missing:
            print(f'[facemorphs] ARKit op ran; placeholdered still-missing: {missing}')
        return ARKIT_CONTRACT_MORPHS
    except Exception as e:  # noqa: BLE001 — fall back to the rename table
        print(f'[facemorphs] hg3d.prepare_for_arkit unavailable ({e}); using rename table')

    _rename_present(mesh, HUMGEN_TO_ARKIT)
    added = [m for m in ARKIT_CONTRACT_MORPHS if _ensure_placeholder(mesh, m)]
    if added:
        print(f'[facemorphs] placeholder ARKit morphs (NEEDS real HumGen source): {added}')
    return ARKIT_CONTRACT_MORPHS


def bind_all(mesh, human=None):
    """Bind both viseme and ARKit morph families. Returns full name list."""
    _require_bpy()
    print('[facemorphs] shape keys before bind:', dump_shape_keys(mesh))
    visemes = bind_visemes(mesh)
    arkit = bind_arkit(mesh, human=human)
    return visemes + arkit
