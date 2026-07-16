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
# VERIFIED against installed HumGen3D v4.0.29 source + live API:
#
#   human.clothing.outfit                -> OutfitSettings   (a @property)
#   human.clothing.footwear              -> FootwearSettings (a @property)
#   outfit.get_options()   -> list[str]  relative preset paths, e.g.
#                                         'outfits/female/Office/New_Intern.blend'
#   outfit.set(preset)                   -> imports + fits the outfit, parents each
#                                           cloth mesh to human.objects.rig with an
#                                           Armature modifier and tags obj['cloth']=1
#   footwear.set(preset)                 -> same, tags obj['shoe']=1
#   outfit.objects / footwear.objects    -> the resulting Blender mesh objects
#
# Under Strategy R the clothing is skinned to HumGen's NATIVE rig here and stays
# there — skeleton.py only aligns that rig's rest and renames its bones, so the
# clothing rides along coherently with no re-skin. VERIFIED: sleeves follow the
# arms under animation (Salute / Crazy-Gesture) with no sheet-explosion.

# Curated presentable presets — a user-facing companion should read as a capable
# assistant, not wear default HumGen underwear. Office / smart-casual wear + dress
# shoes. The seed picks deterministically within the list. Every path VERIFIED to
# exist in the installed content library (~/HumGen_content).
_OUTFIT_PRESETS = {
    'female': [
        'outfits/female/Office/New_Intern.blend',
        'outfits/female/Office/Pantsuit.blend',
        'outfits/female/Office/Relaxed_Dresscode.blend',
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
    """Dress the human in a presentable outfit + footwear on its NATIVE rig.

    Applies a curated Office/Casual outfit and matching footwear via the verified
    HumGen v4.0.29 clothing API. The clothing meshes bind to the HumGen rig here;
    Strategy R aligns that rig's rest and renames its bones afterward, so the
    clothing rides along with no re-skin.

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
            created.extend(list(outfit.objects))
            print(f'[humgen] applied outfit: {preset} ({len(list(outfit.objects))} mesh objs)')
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
            created.extend(list(footwear.objects))
            print(f'[humgen] applied footwear: {preset} ({len(list(footwear.objects))} mesh objs)')
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
    covered torso/arms/legs. If the texture bake runs with those masks live, the
    hidden body geometry is skipped, and the clothing that sits directly over it can
    bake black where the bake ray finds no backing surface — producing the black
    chest/breast blotches seen otherwise. Stripping the masks first lets ``bake_all``
    texture the ENTIRE body so nothing bakes black. Returns the removed mask names.
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
        print(f'[humgen] removed {len(removed)} body clothing-mask(s) before bake '
              f'({", ".join(removed)})')
    return removed


def convert_hair_to_mesh(human):
    """Convert HumGen's particle scalp hair to an exportable haircard MESH.

    glTF does NOT export Blender particle hair, so a HumGen human exports BALD unless
    its hair is first converted to mesh. HumGen's ``regular_hair.convert_to_haircards``
    (VERIFIED v4.0.29) bakes the scalp particle systems into a ``Haircards`` mesh
    (haircap + cards). That mesh is parented to the rig object but ships with NO
    armature modifier / vertex groups, so we bind it to the ``head`` deform bone
    (100 %) here — the scalp only ever moves with the head — so the hair rides head
    motion. (Done BEFORE the retarget, so it weights the ``head`` bone by its HumGen
    name; skeleton.py renames ``head`` -> ``Head`` on both the bone and this group.)

    Returns the haircard Blender object, or None if the human has no hair / the
    conversion is unavailable (logged, never fatal — a bald avatar still works).
    """
    _require_bpy()
    try:
        regular = human.hair.regular_hair
        if not getattr(regular, 'modifiers', None):
            print('[humgen] no scalp hair to convert (bald preset)')
            return None
        hair_obj = regular.convert_to_haircards(quality='high', context=bpy.context)
    except Exception as e:  # noqa: BLE001
        print(f'[humgen] hair->haircards conversion skipped: {e}')
        return None
    if hair_obj is None:
        return None

    rig = human.objects.rig
    # bind the haircard mesh to the head bone so it follows head animation.
    # NB: HumGen parents the haircards with parent_type='BONE' (rigid bone-parenting).
    # The glTF exporter does NOT emit skin data for a BONE-parented mesh, so it would
    # export un-skinned. We convert it to a proper OBJECT-parented + Armature-modifier
    # skin (exactly how HumGen binds clothing, which DOES export skinned): weight every
    # vert 100% to 'head' so the scalp mesh rides head rotation.
    try:
        # reset to object-parenting (clears the BONE parent) so the export skins it
        world = hair_obj.matrix_world.copy()
        hair_obj.parent = rig
        hair_obj.parent_type = 'OBJECT'
        hair_obj.parent_bone = ''
        hair_obj.matrix_world = world  # keep it in place after reparent
        vg = hair_obj.vertex_groups.get('head') or hair_obj.vertex_groups.new(name='head')
        vg.add(range(len(hair_obj.data.vertices)), 1.0, 'REPLACE')
        if not any(m.type == 'ARMATURE' for m in hair_obj.modifiers):
            am = hair_obj.modifiers.new(name='HG_Armature', type='ARMATURE')
            am.object = rig
        print(f'[humgen] converted hair to mesh ({len(hair_obj.data.vertices)} verts), '
              f'skinned 100% to head bone')
    except Exception as e:  # noqa: BLE001
        print(f'[humgen] hair bind to head skipped: {e}')
    return hair_obj


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
