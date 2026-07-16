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


def _require_bpy():
    if bpy is None:
        raise RuntimeError('humgen.py must run inside Blender (bpy unavailable)')


def _require_humgen():
    _require_bpy()
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
# Clothing (outfit + footwear)
# ---------------------------------------------------------------------------
#
# VERIFIED against installed HumGen3D v4.0.29 source
# (human/clothing/{clothing,outfit,footwear,base_clothing}.py):
#
#   human.clothing                       -> ClothingSettings (a @property)
#   human.clothing.outfit                -> OutfitSettings   (a @property)
#   human.clothing.footwear              -> FootwearSettings (a @property)
#   outfit.get_options()   -> list[str]  relative preset paths, e.g.
#                                         'outfits/female/Office/Pantsuit.blend'
#   outfit.set(preset)                   -> imports + fits the outfit, tags each
#                                           mesh obj['cloth']=1, parents to
#                                           human.objects.rig with an Armature mod
#   footwear.set(preset) / .set_random() -> same, tags obj['shoe']=1
#   outfit.objects / footwear.objects    -> the resulting Blender mesh objects
#
# NB: set()/set_random() skin the clothing to the *HumGen* rig (HG-named vertex
# groups). Strategy D swaps that rig for the RPM skeleton, so skeleton.py must
# re-transfer weights onto the clothing meshes exactly like it does the body —
# see skeleton.reskin_to_rpm / transfer_weights_to_clothing.

# Curated presentable presets — a user-facing companion must look professional,
# not wear default HumGen underwear. Office wear + dress shoes reads as a capable
# assistant. Kept per-gender; the seed picks deterministically within the list.
_OUTFIT_PRESETS = {
    'female': [
        'outfits/female/Office/Pantsuit.blend',
        'outfits/female/Office/Relaxed_Dresscode.blend',
        'outfits/female/Office/New_Intern.blend',
        'outfits/female/Casual/Smart_Casual.blend',
        'outfits/female/Casual/Stylish_Casual.blend',
    ],
    'male': [
        'outfits/male/Office/Suit_N_Tie.blend',
        'outfits/male/Office/Relaxed_Dresscode.blend',
        'outfits/male/Office/New_Intern.blend',
        'outfits/male/Casual/Smart_Casual.blend',
        'outfits/male/Casual/Stylish_Casual.blend',
    ],
}
_FOOTWEAR_PRESETS = {
    'female': [
        'footwear/female/Office/HG_Leather_Dress_Shoe.blend',
        'footwear/female/Office/HG_Suede_Dress_Shoe.blend',
        'footwear/female/Sneakers/HG_Leather_Sneakers_Female.blend',
    ],
    'male': [
        'footwear/male/Office/HG_Leather_Dress_Shoe.blend',
        'footwear/male/Sneakers/HG_Leather_Sneakers_Male.blend',
    ],
}


def _pick(options, presets, gender, seed):
    """Choose a preset: prefer a curated one that exists in ``options``, else fall
    back to the first available option so a content-pack rename never aborts."""
    valid = [p for p in presets.get(gender, []) if p in options]
    pool = valid if valid else list(options)
    if not pool:
        return None
    idx = (seed if seed is not None else 0) % len(pool)
    return pool[idx]


def apply_clothing(human, gender='female', seed=None):
    """Dress the human in a presentable outfit + footwear BEFORE the re-skin.

    Applies a curated Office/Casual outfit and matching footwear via the verified
    HumGen v4.0.29 clothing API. The clothing meshes are parented to the HumGen
    rig here; skeleton.py re-skins them onto the RPM armature afterwards (they go
    through the same Data-Transfer weight step as the body).

    Returns the list of created clothing/footwear Blender objects (may be empty if
    the content packs lack outfits — logged, never fatal).
    """
    _require_bpy()
    created = []
    try:
        outfit = human.clothing.outfit
        options = outfit.get_options()
        preset = _pick(options, _OUTFIT_PRESETS, gender, seed)
        if preset:
            outfit.set(preset)
            created.extend(outfit.objects)
            print(f'[humgen] applied outfit: {preset} '
                  f'({len(outfit.objects)} mesh objs)')
        else:
            print('[humgen] WARNING: no outfit options found — human stays undressed')
    except Exception as e:  # noqa: BLE001
        print(f'[humgen] outfit.set failed: {e}')

    try:
        footwear = human.clothing.footwear
        options = footwear.get_options()
        preset = _pick(options, _FOOTWEAR_PRESETS, gender, seed)
        if preset:
            footwear.set(preset)
            created.extend(footwear.objects)
            print(f'[humgen] applied footwear: {preset} '
                  f'({len(footwear.objects)} mesh objs)')
        else:
            print('[humgen] WARNING: no footwear options found')
    except Exception as e:  # noqa: BLE001
        print(f'[humgen] footwear.set failed: {e}')

    if not created:
        print('[humgen] WARNING: no clothing applied — the avatar will be nude. '
              'Verify the Base_Clothes content pack is installed.')
    return created


def unmask_body_for_bake(human):
    """Remove HumGen's clothing geometry-mask modifiers from the body BEFORE baking.

    When clothing is applied, HumGen adds inverted ``MASK`` modifiers that HIDE the
    covered torso/arms/legs. If the bake runs with those masks live, the hidden skin
    is left un-baked (black), and if we later keep the full body (so a wide collar
    doesn't leave a neck gap) that black skin shows. Stripping the masks first makes
    ``bake_all`` texture the ENTIRE body, so the full body can be kept and stays
    fully skinned — no black patches, no neck gap. Returns the removed mask names.
    """
    _require_bpy()
    try:
        body = human.objects.body
    except Exception:  # noqa: BLE001
        return []
    removed = []
    for mod in list(body.modifiers):
        if mod.type == 'MASK':
            removed.append(mod.name)
            body.modifiers.remove(mod)
    if removed:
        print(f'[humgen] removed {len(removed)} body clothing-masks before bake '
              f'({", ".join(removed)}) so the full body bakes')
    return removed


def get_clothing_objects(human):
    """Return the current outfit + footwear mesh objects on the human.

    Uses the same custom-property tags HumGen sets (``cloth`` / ``shoe``) so this
    works even after the rig is swapped. Falls back to the OutfitSettings /
    FootwearSettings ``.objects`` accessors.
    """
    objs = []
    try:
        objs.extend(human.clothing.outfit.objects)
        objs.extend(human.clothing.footwear.objects)
    except Exception:  # noqa: BLE001
        pass
    if not objs and bpy is not None:
        objs = [o for o in bpy.data.objects
                if o.type == 'MESH' and ('cloth' in o or 'shoe' in o)]
    # de-dup, keep only meshes
    seen, out = set(), []
    for o in objs:
        if o is not None and getattr(o, 'type', None) == 'MESH' and o.name not in seen:
            seen.add(o.name)
            out.append(o)
    return out


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
