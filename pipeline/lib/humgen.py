"""HumGen3D step — generate a parametric human headlessly.

Wraps the HumGen3D v4 Python API (``HumGen3D.Human``). All API calls are
flagged where the exact v4.0.27 signature is uncertain — verify against
``help.humgen3d.com/api`` and the installed addon source.

Runs under ``blender --background`` — but HumGen hard-requires the ``.hgpack``
content packs installed and a content path set (see install_addons.py) or human
creation fails. Some UI-only ops need ``bpy.context.temp_override``.
"""

import random

try:
    import bpy
except ImportError:
    bpy = None


def _require_humgen():
    if bpy is None:
        raise RuntimeError('humgen.py must run inside Blender (bpy unavailable)')
    try:
        from HumGen3D import Human  # noqa: F401
    except ImportError as e:
        raise RuntimeError(
            'HumGen3D not installed/enabled. Run pipeline/install_addons.py first '
            'and ensure the .hgpack content packs are installed '
            '(see pipeline/README.md and docs/DRIVE-ASSETS.md).'
        ) from e


def generate_human(seed=None, gender='male', height=None):
    """Create and finalize a HumGen human. Returns the HumGen ``Human`` wrapper.

    Args:
        seed: int — deterministic RNG seed for reproducible randomization.
        gender: 'male' | 'female'.
        height: float | None — target height in metres (e.g. 1.80). None = default.
    """
    _require_humgen()
    from HumGen3D import Human

    if seed is not None:
        random.seed(seed)

    # --- 1. start a human from a preset ---
    # VERIFIED against installed HumGen3D v4.0.29:
    #   chosen = Human.get_preset_options(gender)   # 42 male presets, e.g.
    #                                               # 'models/male/Hispanic/Luke.json'
    #   human  = Human.from_preset(chosen[i])       # returns an exportable Human
    # NB: presets reference hair assets, so the Base_Hair pack MUST be imported or
    # from_preset raises FileNotFoundError on a missing hair .json.
    try:
        options = Human.get_preset_options(gender)
        if seed is not None and options:
            preset = options[seed % len(options)]
        else:
            preset = options[0]
        human = Human.from_preset(preset)
    except AttributeError:
        # Older/newer signature fallback — some builds expose Human.from_preset
        # keyed differently, or a Human() + .create() flow.
        raise RuntimeError(
            'HumGen Human.from_preset signature mismatch — verify the v4.0.29 API '
            '(help.humgen3d.com/api) and update humgen.py.'
        )

    # --- 2. randomize body / face / skin to diversify ---
    # VERIFIED v4.0.29: human.body / .face / .skin are @property settings objects
    # each exposing a no-arg .randomize(). NB: do NOT do a truthiness test on these
    # (e.g. `if obj`) — they are HumGen prop_collection wrappers whose __len__ can
    # recurse; call .randomize() directly under try/except instead.
    for randomizer in ('body', 'face', 'skin'):
        try:
            settings = getattr(human, randomizer)
            settings.randomize()
        except Exception as e:  # noqa: BLE001 — don't abort on one sub-randomizer
            print(f'[humgen] {randomizer}.randomize() skipped: {e}')

    # hair is nested differently across versions
    _try_randomize_hair(human)

    # --- 3. set height if requested ---
    if height is not None:
        _set_height(human, height)

    # --- 4. finalize ---
    # VERIFIED against HumGen3D v4.0.29 source: v4 has NO creation/finalize phase
    # split (that was v3). from_preset() returns a real, exportable mesh directly —
    # no finish step is needed. _finish_creation() is kept as a harmless no-op guard
    # for any build that still exposes the old method.
    _finish_creation(human)

    print(f'[humgen] generated {gender} human (seed={seed}, height={height})')
    return human


def _try_randomize_hair(human):
    try:
        hair = human.hair
    except Exception:  # noqa: BLE001
        return
    for attr in ('regular_hair', 'face_hair', 'eyebrows'):
        try:
            sub = getattr(hair, attr)
            sub.randomize()
        except Exception as e:  # noqa: BLE001
            print(f'[humgen] hair.{attr}.randomize() skipped: {e}')


def _set_height(human, height):
    # v4.0.29: human.height.set(height_cm) — HumGen's height API works in
    # centimetres. We pass metres in, so convert. Guarded so a signature drift
    # doesn't abort the whole build.
    try:
        human.height.set(height * 100.0)
        print(f'[humgen] set height to {height} m ({height * 100.0:.0f} cm)')
        return
    except Exception as e:  # noqa: BLE001
        print(f'[humgen] height.set({height}) failed: {e}; leaving default height')


def _finish_creation(human):
    # v4.0.29 has no creation-phase finalize (verified). Call the legacy method only
    # if a build still exposes it; otherwise this is a silent no-op.
    finish = getattr(human, 'finish_creation_phase', None)
    if callable(finish):
        try:
            finish()
        except Exception as e:  # noqa: BLE001
            print(f'[humgen] finish_creation_phase() skipped: {e}')


# ---------------------------------------------------------------------------
# clothing + hair  (VERIFIED against HumGen3D v4.0.29)
# ---------------------------------------------------------------------------

# Short, close-to-scalp cuts that DON'T drape long cards over the face (which
# render as a shard-mass over the eyes). Keyed by gender; falls back to random.
_SHORT_HAIR = {
    'male':   'hair/head/male/Short/Short Combed.json',
    'female': 'hair/head/female/Short/Short Combed.json',
}


def add_clothing(human, gender='female', outfit=None, footwear=None, seed=None):
    """Dress the human — outfit + footwear. VERIFIED v4.0.29:
    ``human.clothing.outfit.set(preset)`` / ``.set_random()`` (23 male / N female
    outfits); same for ``.footwear``. Each adds skinned garment meshes parented to
    the HumGen rig (they ride the body under animation).
    """
    _require_humgen()
    import bpy as _bpy
    ctx = _bpy.context
    cl = getattr(human, 'clothing', None)
    if cl is None:
        print('[humgen] no clothing API — skipping outfit/footwear')
        return
    try:
        if outfit:
            cl.outfit.set(outfit, context=ctx)
        else:
            cl.outfit.set_random(context=ctx)
        print('[humgen] outfit set')
    except Exception as e:  # noqa: BLE001
        print(f'[humgen] outfit failed: {e}')
    try:
        if footwear:
            cl.footwear.set(footwear, context=ctx)
        else:
            cl.footwear.set_random(context=ctx)
        print('[humgen] footwear set')
    except Exception as e:  # noqa: BLE001
        print(f'[humgen] footwear failed: {e}')


def add_hair_haircards(human, gender='female', style=None):
    """Give the human short hair and convert the particle systems to HAIRCARD
    meshes so the hair survives glTF/VRM export (particle hair does not).

    VERIFIED v4.0.29: ``human.hair.regular_hair.set(preset)`` then
    ``.convert_to_haircards(quality='high', context=...)`` per system
    (regular_hair, eyebrows, eyelashes). We pick a SHORT scalp cut so cards don't
    drape over the face. vrm_export then binds + alpha-fixes the resulting cards.
    """
    _require_humgen()
    import bpy as _bpy
    ctx = _bpy.context
    hair = getattr(human, 'hair', None)
    if hair is None:
        print('[humgen] no hair API — skipping')
        return
    style = style or _SHORT_HAIR.get(gender)
    try:
        if style:
            hair.regular_hair.set(style, context=ctx)
        else:
            hair.regular_hair.set_random(context=ctx)
        print(f'[humgen] hair set ({style or "random"})')
    except Exception as e:  # noqa: BLE001
        print(f'[humgen] hair set failed ({e}); trying random')
        try:
            hair.regular_hair.set_random(context=ctx)
        except Exception as e2:  # noqa: BLE001
            print(f'[humgen] hair random also failed: {e2}')
    for sysname in ('regular_hair', 'eyebrows', 'eyelashes'):
        sub = getattr(hair, sysname, None)
        if sub is None:
            continue
        try:
            obj = sub.convert_to_haircards(quality='high', context=ctx)
            print(f'[humgen] haircards {sysname}: {obj.name if obj else None}')
        except Exception as e:  # noqa: BLE001
            print(f'[humgen] haircard {sysname} failed: {e}')


def get_body_object(human):
    """Return the HumGen body mesh Blender object.

    VERIFIED against v4.0.29: the body mesh is ``human.objects.body`` (the
    ``HG_Body`` object). Older ``body_obj``/``body_object`` attrs are tried as a
    fallback, then a name lookup for ``HG_Body``.
    """
    objs = getattr(human, 'objects', None)
    if objs is not None:
        body = getattr(objs, 'body', None)
        if body is not None and getattr(body, 'type', None) == 'MESH':
            return body
    for attr in ('body_obj', 'body_object'):
        val = getattr(human, attr, None)
        if val is not None and getattr(val, 'type', None) == 'MESH':
            return val
    if bpy is not None:
        named = bpy.data.objects.get('HG_Body')
        if named is not None:
            return named
    raise RuntimeError('could not resolve HumGen body object — verify HumGen API')
