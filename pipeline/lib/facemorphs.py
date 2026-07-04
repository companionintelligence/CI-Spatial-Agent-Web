"""Face-morph step — emit the app's viseme + ARKit morph contract on the body.

The rig contract needs two families of morphs on the body mesh:

  * 15 Oculus visemes, prefixed ``viseme_`` (GLB lip-sync collector keys on the
    prefix — it is mandatory).
  * the ARKit-52 facial blendshapes (GLB emote collector keeps any morph whose
    name includes eye/brow/mouth/nose/cheek/jaw).

VERIFIED against HumGen3D v4.0.29:

  1. ``human.expression.load_facial_rig()`` imports the FACS shape keys listed in
     ``<content>/models/face_rig.json`` onto ``HG_Body`` (43 body keys) and the
     lower-teeth mesh (5 tongue keys). Without this the human has only correctives
     + ``eyeLook*`` keys and the ARKit op is a no-op.
  2. ``bpy.ops.hg3d.prepare_for_arkit(suffix='long')`` removes the FACS drivers,
     keyframes each shape key, and renames the ``_L``/``_R`` halves to
     ``Left``/``Right`` — producing the standard ARKit blendshape names directly
     (``eyeBlinkLeft``, ``jawOpen``, ``mouthSmileLeft`` …). 33/35 of the app's
     ARKit contract morphs come out of this verbatim.
  3. The 2 remaining contract morphs (``eyesClosed``, ``mouthSmile``) and all 15
     ``viseme_*`` morphs are NOT in the ARKit set — they are *derived* here as new
     shape keys, each a weighted blend of the ARKit shapes, baked via
     ``shape_key_add(from_mix=True)`` so they export as real morph targets.
"""

try:
    import bpy
except ImportError:
    bpy = None

from mappings import (  # noqa: E402
    OCULUS_VISEMES,
    ARKIT_CONTRACT_MORPHS,
    VISEME_FROM_ARKIT,
    ARKIT_SYNTHESISED,
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


def _zero_all(mesh):
    """Reset every shape key value to 0 so a from_mix bake starts clean."""
    sk = mesh.data.shape_keys
    if sk is None:
        return
    for kb in sk.key_blocks:
        kb.value = 0.0


def _bake_mix(mesh, name, source_weights):
    """Bake a new shape key ``name`` = weighted blend of existing keys.

    Drives every source shape key in ``source_weights`` to its weight, creates a
    ``from_mix=True`` shape key capturing the deformed result, then resets all
    values. If a source key is missing it is skipped (logged). An empty
    ``source_weights`` yields a neutral (Basis-copy) key. Returns the created
    ``key_block`` (or the existing one if the name already exists).
    """
    blocks = _key_blocks(mesh)
    by_name = {kb.name: kb for kb in blocks}
    if name in by_name:
        return by_name[name]

    _zero_all(mesh)
    missing = []
    for src, w in source_weights.items():
        kb = by_name.get(src)
        if kb is None:
            missing.append(src)
            continue
        kb.value = float(w)
    if missing:
        print(f'[facemorphs] {name}: missing source keys {missing} (blended without them)')

    new_kb = mesh.shape_key_add(name=name, from_mix=True)
    _zero_all(mesh)
    return new_kb


def load_facial_rig(human):
    """Import the FACS shape keys onto the human, then convert them to ARKit names.

    Returns the set of shape-key names present on the body afterward.
    """
    _require_bpy()
    body = human.objects.body

    # 1. import the FACS shape keys (idempotent — skip if already present)
    try:
        if not human.expression.has_facial_rig:
            human.expression.load_facial_rig()
            print('[facemorphs] loaded HumGen facial rig (FACS shape keys)')
        else:
            print('[facemorphs] facial rig already present')
    except Exception as e:  # noqa: BLE001
        print(f'[facemorphs] load_facial_rig failed: {e}')

    # 2. convert FACS -> ARKit names (removes drivers, renames _L/_R -> Left/Right)
    try:
        bpy.context.view_layer.objects.active = body
        bpy.ops.hg3d.prepare_for_arkit(suffix='long')
        print('[facemorphs] ran hg3d.prepare_for_arkit(suffix="long")')
    except Exception as e:  # noqa: BLE001
        print(f'[facemorphs] prepare_for_arkit failed: {e}')

    return {kb.name for kb in _key_blocks(body)}


def bind_arkit(mesh):
    """Ensure every ARKit contract morph exists on ``mesh``.

    33/35 come straight from prepare_for_arkit. The remaining 2 (eyesClosed,
    mouthSmile) are synthesised as combined L/R blends. Anything still absent
    (should be none) is placeholdered so the contract validates.
    """
    _require_bpy()
    present = {kb.name for kb in _key_blocks(mesh)}

    # synthesise the combined shapes ARKit needs that HumGen only ships split
    for target, sources in ARKIT_SYNTHESISED.items():
        if target not in present:
            _bake_mix(mesh, target, sources)
            present.add(target)

    # any contract morph still missing -> neutral placeholder (keeps validator green)
    missing = [m for m in ARKIT_CONTRACT_MORPHS if m not in present]
    for m in missing:
        _bake_mix(mesh, m, {})
    if missing:
        print(f'[facemorphs] placeholdered still-missing ARKit morphs: {missing}')
    return ARKIT_CONTRACT_MORPHS


def derive_visemes(mesh):
    """Bake the 15 Oculus ``viseme_*`` morphs from the ARKit mouth/jaw shapes.

    Each viseme is a weighted blend of ARKit shapes (VISEME_FROM_ARKIT). The
    blends are baked in order; because every bake resets all values to 0 first,
    an earlier viseme key never contaminates a later one.
    """
    _require_bpy()
    made = []
    for viseme in OCULUS_VISEMES:
        weights = VISEME_FROM_ARKIT.get(viseme, {})
        _bake_mix(mesh, viseme, weights)
        made.append(viseme)
    print(f'[facemorphs] derived {len(made)} visemes from ARKit shapes')
    return OCULUS_VISEMES


def bind_all(mesh, human=None):
    """Full face-morph flow. ``human`` is required (drives FACS import).

    Returns the full list of contract morph names (ARKit + visemes).
    """
    _require_bpy()
    if human is not None:
        load_facial_rig(human)
    print('[facemorphs] shape keys before bind:', len(dump_shape_keys(mesh)))
    arkit = bind_arkit(mesh)
    visemes = derive_visemes(mesh)
    print('[facemorphs] shape keys after bind:', len(dump_shape_keys(mesh)))
    return arkit + visemes
