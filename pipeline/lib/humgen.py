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

    # --- 1. start a human in the creation phase ---
    # TODO: verify against installed addon. HumGen v4 API is approximately:
    #   chosen = Human.get_preset_options(gender)      # list of starting presets
    #   human  = Human.from_preset(chosen[i])          # or Human.from_preset_gender
    # Fall back to picking the first preset for the requested gender.
    try:
        options = Human.get_preset_options(gender)          # TODO: verify
        if seed is not None and options:
            preset = options[seed % len(options)]
        else:
            preset = options[0]
        human = Human.from_preset(preset)                   # TODO: verify
    except AttributeError:
        # Older/newer signature fallback — some builds expose Human.from_preset
        # keyed differently, or a Human() + .create() flow.
        raise RuntimeError(
            'HumGen Human.from_preset signature mismatch — verify the v4.0.27 API '
            '(help.humgen3d.com/api) and update humgen.py.'
        )

    # --- 2. randomize body / face / skin / hair to diversify ---
    # TODO: verify against installed addon. v4 exposes property-group randomizers:
    #   human.body.randomize(); human.face.randomize()
    #   human.skin.randomize(); human.hair.regular_hair.randomize()
    for randomizer in ('body', 'face', 'skin'):
        obj = getattr(human, randomizer, None)
        rnd = getattr(obj, 'randomize', None) if obj else None
        if callable(rnd):
            try:
                rnd()                                       # TODO: verify signature
            except Exception as e:  # noqa: BLE001 — don't abort on one sub-randomizer
                print(f'[humgen] {randomizer}.randomize() skipped: {e}')

    # hair is nested differently across versions
    _try_randomize_hair(human)

    # --- 3. set height if requested ---
    if height is not None:
        _set_height(human, height)

    # --- 4. finalize (leave creation phase so the mesh is real & exportable) ---
    # TODO: verify against installed addon. v4: human.finish_creation_phase()
    # or human.creation_phase.finish(). Try both.
    _finish_creation(human)

    print(f'[humgen] generated {gender} human (seed={seed}, height={height})')
    return human


def _try_randomize_hair(human):
    hair = getattr(human, 'hair', None)
    if hair is None:
        return
    for attr in ('regular_hair', 'face_hair', 'eyebrows'):
        sub = getattr(hair, attr, None)
        rnd = getattr(sub, 'randomize', None) if sub else None
        if callable(rnd):
            try:
                rnd()                                       # TODO: verify
            except Exception as e:  # noqa: BLE001
                print(f'[humgen] hair.{attr}.randomize() skipped: {e}')


def _set_height(human, height):
    # TODO: verify against installed addon. v4: human.height.set(height) (metres)
    height_api = getattr(human, 'height', None)
    setter = getattr(height_api, 'set', None) if height_api else None
    if callable(setter):
        try:
            setter(height)                                  # TODO: verify units (m vs cm)
            return
        except Exception as e:  # noqa: BLE001
            print(f'[humgen] height.set({height}) failed: {e}')
    print(f'[humgen] height not applied ({height}) — verify HumGen height API')


def _finish_creation(human):
    for attempt in (
        lambda: human.finish_creation_phase(),              # TODO: verify
        lambda: human.creation_phase.finish(),              # TODO: verify
    ):
        try:
            attempt()
            return
        except Exception:  # noqa: BLE001
            continue
    print('[humgen] WARNING: could not finish creation phase — verify HumGen API. '
          'Export may still work if the addon auto-finalizes on export.')


def get_body_object(human):
    """Return the HumGen body mesh Blender object."""
    # TODO: verify against installed addon. v4 commonly: human.body_obj
    for attr in ('body_obj', 'body_object', 'objects'):
        val = getattr(human, attr, None)
        if val is None:
            continue
        if hasattr(val, 'type') and val.type == 'MESH':
            return val
        # 'objects' may be a collection wrapper with .body
        body = getattr(val, 'body', None)
        if body is not None:
            return body
    raise RuntimeError('could not resolve HumGen body object — verify HumGen API')
