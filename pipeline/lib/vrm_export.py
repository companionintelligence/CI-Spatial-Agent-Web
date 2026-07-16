"""VRM export step — configure the VRM humanoid + expressions and export ``.vrm``.

Targets **VRM 1.0** (docs/FACIAL-ANIMATION-PLAN.md §"VRM-first HumGen"). Uses the
``saturday06/VRM-Addon-for-Blender`` addon (module ``io_scene_vrm``, installed as
v4.3.1). This is the *native* VRM path: the HumGen character stays on its own
Rigify rig — head, eyes, teeth, hair and clothing all bound to it, NOTHING
re-seated — and we map that rig onto the VRM humanoid so the app's
``@pixiv/three-vrm-animation`` retargets the shared VRMA clips by humanoid bone.
Because the head parts ride HumGen's own rig, teeth stay inside the mouth and
eyes stay in their sockets (the exact fragility that broke the RPM re-skin).

Two things are configured on the armature *data-block* before export, then the
addon's ``export_scene.vrm`` operator writes the file:

  1. Humanoid bone assignment — ``HUMGEN_TO_VRM_HUMANBONES`` (HumGen Rigify deform
     bone -> VRM humanoid slot). Path (VERIFIED against io_scene_vrm 4.3.1):
     ``armature.data.vrm_addon_extension.vrm1.humanoid.human_bones.<slot>.node.bone_name``.
     Slot attrs are snake_case (``left_upper_arm`` etc).
  2. Expressions — VRM1 presets live at ``ext.vrm1.expressions.preset.<name>``
     (aa/ee/ih/oh/ou, happy/angry/sad/relaxed/surprised, blink/blink_left/
     blink_right/neutral). Each has ``.morph_target_binds`` (a collection); each
     bind exposes ``.node.mesh_object_name`` (str), ``.index`` (int morph index),
     ``.weight`` (float). Full ARKit-52 detail is additionally attached as VRM
     *custom* expressions (``ext.vrm1.expressions.custom.add()``) so the app can
     drive the fine face when a head is classified ``arkit`` tier.

The app applies ``VRMUtils.rotateVRM0`` only for VRM0; targeting VRM1 makes that
a no-op (forward = -Z on the VRM path), so posture is correct without the hack.
"""

import os

try:
    import bpy
except ImportError:
    bpy = None

from mappings import (  # noqa: E402
    HUMGEN_TO_VRM_HUMANBONES,
    VRM_REQUIRED_HUMANBONES,
    VRM_VISEME_PRESETS,
    VRM_EXPRESSION_BINDS,
    ARKIT_CONTRACT_MORPHS,
)

# VRM1 expression-preset attr names are snake_case on the addon; the app's
# emote/viseme services key expressions by the VRM1 glTF names (camelCase for
# blinkLeft/blinkRight, which the addon emits from blink_left/blink_right). This
# maps our mapping-table preset keys -> the addon's python attr on
# ``expressions.preset``.
_PRESET_ATTR = {
    'aa': 'aa', 'ee': 'ee', 'ih': 'ih', 'oh': 'oh', 'ou': 'ou',
    'happy': 'happy', 'angry': 'angry', 'sad': 'sad',
    'relaxed': 'relaxed', 'surprised': 'surprised',
    'neutral': 'neutral', 'blink': 'blink',
    'blinkLeft': 'blink_left', 'blinkRight': 'blink_right',
}


def _require_vrm():
    if bpy is None:
        raise RuntimeError('vrm_export.py must run inside Blender (bpy unavailable)')
    if 'io_scene_vrm' not in bpy.context.preferences.addons:
        try:
            bpy.ops.preferences.addon_enable(module='io_scene_vrm')
        except Exception as e:  # noqa: BLE001
            raise RuntimeError(
                'VRM addon (io_scene_vrm) not enabled. Run pipeline/install_addons.py '
                'first (saturday06/VRM-Addon-for-Blender).'
            ) from e


def _vrm1(armature):
    ext = getattr(armature.data, 'vrm_addon_extension', None)
    if ext is None:
        raise RuntimeError('vrm_addon_extension missing on armature — is the VRM addon enabled?')
    return ext.vrm1


def assign_humanoid(armature):
    """Assign HumGen Rigify deform bones to VRM 1.0 humanoid slots on the armature.

    VERIFIED path (io_scene_vrm 4.3.1):
      ``armature.data.vrm_addon_extension.vrm1.humanoid.human_bones.<slot>.node.bone_name``
    Slot attrs are snake_case. Returns the number of slots assigned. Raises if a
    VRM-*required* humanoid bone could not be resolved on the rig.
    """
    _require_vrm()
    human_bones = _vrm1(armature).humanoid.human_bones
    bone_names = {b.name for b in armature.data.bones}

    assigned = {}
    for humgen_bone, vrm_slot in HUMGEN_TO_VRM_HUMANBONES.items():
        slot = getattr(human_bones, vrm_slot, None)
        if slot is None:
            print(f'[vrm_export] no VRM slot {vrm_slot!r} — skipping {humgen_bone}')
            continue
        if humgen_bone not in bone_names:
            print(f'[vrm_export] HumGen bone {humgen_bone!r} absent — {vrm_slot} left empty')
            continue
        slot.node.bone_name = humgen_bone
        assigned[vrm_slot] = humgen_bone

    missing_req = [s for s in VRM_REQUIRED_HUMANBONES if s not in assigned]
    if missing_req:
        raise RuntimeError(
            f'[vrm_export] required VRM humanoid bones unassigned: {missing_req}. '
            f'Rig bones present: {sorted(bone_names)[:20]}...'
        )
    print(f'[vrm_export] assigned {len(assigned)}/{len(HUMGEN_TO_VRM_HUMANBONES)} humanoid bones '
          f'(all {len(VRM_REQUIRED_HUMANBONES)} required present)')
    return assigned


def _bind_preset(preset_obj, mesh, morph_names_to_weight):
    """Add morph_target_binds on ``preset_obj`` for each (morph_name -> weight).

    Binds use the mesh object name + the shape-key *name* (io_scene_vrm 4.3.1's
    ``bind.index`` is the morph-target NAME string, not an int index — VERIFIED).
    Missing morphs are skipped.
    """
    kb_names = {b.name for b in mesh.data.shape_keys.key_blocks}
    added = 0
    for morph_name, weight in morph_names_to_weight.items():
        if morph_name not in kb_names:
            continue
        b = preset_obj.morph_target_binds.add()
        b.node.mesh_object_name = mesh.name
        b.index = morph_name
        b.weight = float(weight)
        added += 1
    return added


def configure_expressions(armature, body_mesh, add_arkit_custom=True):
    """Author VRM1 expression presets (+ optional ARKit-52 custom expressions).

    Standard presets (the app auto-detects these):
      * 5 mouth visemes aa/ee/ih/oh/ou  — each bound to the collapsed Oculus
        ``viseme_*`` morphs (VRM_VISEME_PRESETS).
      * emotion/blink presets happy/angry/sad/relaxed/surprised/blink/neutral —
        bound to the ARKit morphs that approximate them (VRM_EXPRESSION_BINDS).
    Custom expressions (VRM1 supports arbitrary ones): every ARKit-52 contract
    morph gets a 1:1 custom expression so the ``arkit`` facial tier can drive full
    detail through the one ``vrm.expressionManager`` path.
    """
    _require_vrm()
    expressions = _vrm1(armature).expressions

    total = 0
    # --- 5 mouth visemes ---
    for preset_key, viseme_morphs in VRM_VISEME_PRESETS.items():
        preset_obj = getattr(expressions.preset, _PRESET_ATTR[preset_key], None)
        if preset_obj is None:
            print(f'[vrm_export] no mouth preset {preset_key!r}')
            continue
        total += _bind_preset(preset_obj, body_mesh, {m: 1.0 for m in viseme_morphs})

    # --- emotion / blink presets ---
    for preset_key, morph_weights in VRM_EXPRESSION_BINDS.items():
        attr = _PRESET_ATTR.get(preset_key)
        if attr is None:
            continue
        preset_obj = getattr(expressions.preset, attr, None)
        if preset_obj is None:
            continue
        total += _bind_preset(preset_obj, body_mesh, morph_weights)

    print(f'[vrm_export] bound {total} morph targets across standard presets')

    # --- ARKit-52 as VRM custom expressions (full detail, arkit tier) ---
    if add_arkit_custom:
        kb_names = {b.name for b in body_mesh.data.shape_keys.key_blocks}
        made = 0
        for morph in ARKIT_CONTRACT_MORPHS:
            if morph not in kb_names:
                continue
            custom = expressions.custom.add()
            custom.custom_name = morph
            _bind_preset(custom, body_mesh, {morph: 1.0})
            made += 1
        print(f'[vrm_export] added {made} ARKit custom expressions')

    return total


def author_meta(armature, name='Aria', author='Companion Intelligence'):
    """Populate the minimal VRM1 meta so the file is a valid, licenced VRM."""
    _require_vrm()
    meta = _vrm1(armature).meta
    try:
        meta.vrm_name = name
        a = meta.authors.add()
        a.value = author
        meta.version = '1'
    except Exception as e:  # noqa: BLE001
        print(f'[vrm_export] meta authoring partial: {e}')


def _prep_textures(max_dim=2048):
    """Load + downscale + pack every image so the VRM embeds real, web-sized pixels.

    HumGen ships 4K/8K skin maps and links them by filepath (``has_data=False``);
    embedded uncompressed these balloon the .vrm to 200 MB+. We:
      1. reload any unloaded image from its filepath,
      2. downscale anything wider/taller than ``max_dim`` (default 2048) in place,
      3. pack all into the .blend so the glTF/VRM exporter writes them into the
         binary (with the exporter's own image compression).
    2048 keeps the skin crisp while landing the file in the 5-25 MB band of the
    other shipping VRM avatars.
    """
    # drop images no material references (e.g. the 4K originals left dangling
    # after skin.texture.set_resolution swapped to a lower-res variant) so we
    # neither reload nor embed them.
    try:
        bpy.ops.outliner.orphans_purge(do_local_ids=True, do_recursive=True)
    except Exception:  # noqa: BLE001
        for img in list(bpy.data.images):
            if img.users == 0:
                bpy.data.images.remove(img)

    for img in bpy.data.images:
        try:
            if not img.has_data and img.filepath:
                img.reload()
        except Exception as e:  # noqa: BLE001
            print(f'[vrm_export] image reload skipped ({img.name}): {e}')

    scaled = 0
    for img in bpy.data.images:
        try:
            w, h = img.size
            if max(w, h) > max_dim and w > 0 and h > 0:
                if w >= h:
                    nw, nh = max_dim, max(1, int(h * max_dim / w))
                else:
                    nw, nh = max(1, int(w * max_dim / h)), max_dim
                img.scale(nw, nh)
                scaled += 1
        except Exception as e:  # noqa: BLE001
            print(f'[vrm_export] image scale skipped ({img.name}): {e}')
    print(f'[vrm_export] downscaled {scaled} images to <= {max_dim}px')

    try:
        bpy.ops.file.pack_all()
        print('[vrm_export] packed all images into blend for embedding')
    except Exception as e:  # noqa: BLE001
        print(f'[vrm_export] pack_all skipped: {e}')


def _images_in_tree(node_tree, seen=None):
    """Yield (node, image) for every image node in a material tree, recursing
    into node groups (HumGen's skin base color hides inside a Gender_Group)."""
    if seen is None:
        seen = set()
    if node_tree in seen:
        return
    seen.add(node_tree)
    for node in node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.image:
            yield node, node.image
        elif node.type == 'GROUP' and node.node_tree:
            yield from _images_in_tree(node.node_tree, seen)


def _pick_color_image(mat, hints=()):
    """Pick the material's diffuse/base-color image.

    HumGen wires Base Color through a procedural chain (freckles × aged-layer ×
    cavity × makeup) the glTF exporter cannot evaluate — it exports red/black
    skin. We bypass that by grabbing the raw sRGB colour map directly. Prefers an
    image whose name matches ``hints``; else the largest sRGB (Color) image.
    """
    color_imgs = [(n, im) for (n, im) in _images_in_tree(mat.node_tree)
                  if im.colorspace_settings.name == 'sRGB'
                  and not im.name.startswith('.fm_')]  # skip freckle/makeup masks
    if not color_imgs:
        return None
    for n, im in color_imgs:
        if any(h.lower() in im.name.lower() for h in hints):
            return im
    # largest by pixel count
    return max(color_imgs, key=lambda ni: (ni[1].size[0] * ni[1].size[1]))[1]


def _pick_by_name(mat, needles, colorspace=None):
    for _n, im in _images_in_tree(mat.node_tree):
        if colorspace and im.colorspace_settings.name != colorspace:
            continue
        if any(nd.lower() in im.name.lower() for nd in needles):
            return im
    return None


def simplify_material(mat, color_hints=(), normal_needles=('norm',), rough_needles=('rough',)):
    """Rebuild ``mat`` as a clean Principled BSDF fed by direct image maps.

    The procedural HumGen skin/eye trees don't survive glTF flattening; a plain
    Principled with the raw base-color (+ optional normal / roughness) map exports
    correctly to glTF and converts to MToon cleanly. Returns True if rebuilt.
    """
    base = _pick_color_image(mat, hints=color_hints)
    if base is None:
        return False
    normal = _pick_by_name(mat, normal_needles, colorspace='Non-Color')
    rough = _pick_by_name(mat, rough_needles, colorspace='Non-Color')

    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (600, 0)
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled'); bsdf.location = (250, 0)
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

    tex = nt.nodes.new('ShaderNodeTexImage'); tex.location = (-150, 150)
    tex.image = base
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])

    if rough is not None:
        rt = nt.nodes.new('ShaderNodeTexImage'); rt.location = (-150, -120)
        rt.image = rough
        nt.links.new(rt.outputs['Color'], bsdf.inputs['Roughness'])
    else:
        bsdf.inputs['Roughness'].default_value = 0.65

    if normal is not None:
        ntex = nt.nodes.new('ShaderNodeTexImage'); ntex.location = (-400, -300)
        ntex.image = normal
        nmap = nt.nodes.new('ShaderNodeNormalMap'); nmap.location = (-150, -300)
        nt.links.new(ntex.outputs['Color'], nmap.inputs['Color'])
        nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    return True


def _find_iris_image(eyes):
    """Locate HumGen's iris colour map across ALL of the eyes object's materials.

    VERIFIED node layout (HumGen v4.0.29): the eyes mesh has 3 material slots —
    ``.HG_Eyes_Inner`` (the iris; base colour is a ``Mix`` fed by
    ``.HG_Eye_Color.png`` + ``.HG_Eyes_Mask.jpg`` + ``.HG_Eye_Scatter.png``) and
    two outer cornea shells (``.HG_Eyes_Outer_FAST`` / ``_Refraction``) that only
    carry normal maps. We want ``.HG_Eye_Color.png`` — the sRGB image whose name
    contains 'eye_color'/'color' and NOT 'mask'/'scatter'/'normal'."""
    best = None
    for slot in eyes.material_slots:
        m = slot.material
        if not m or not m.use_nodes:
            continue
        for _n, im in _images_in_tree(m.node_tree):
            nm = im.name.lower()
            if im.colorspace_settings.name != 'sRGB':
                continue
            if any(bad in nm for bad in ('mask', 'scatter', 'normal', 'norm')):
                continue
            if 'eye_color' in nm or 'iris' in nm:
                return im            # exact iris map — take immediately
            if 'color' in nm and best is None:
                best = im
    return best


def _rebuild_eye_inner(mat, iris_img):
    """Rebuild the iris material as an opaque Principled fed by the iris colour map."""
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (400, 0)
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled'); bsdf.location = (120, 0)
    bsdf.inputs['Roughness'].default_value = 0.25
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.location = (-260, 0)
    tex.image = iris_img
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    mat.blend_method = 'OPAQUE'
    mat.use_backface_culling = False
    _set_mtoon(mat, iris_img, mode='OPAQUE', cutoff=0.5, tint=None)


def _rebuild_eye_outer_transparent(mat):
    """Rebuild an outer cornea/refraction shell as fully TRANSPARENT.

    HumGen's outer shells are Glass/Mix shaders the glTF exporter can't evaluate,
    so left alone they flatten to an OPAQUE WHITE sphere that hides the iris — the
    'blank white eyes' break. The cornea is physically a clear coat, so we author
    it as a transparent MToon (alphaMode=BLEND, alpha≈0); the iris underneath then
    shows through, and specular life comes from the scene lighting on the sclera.
    """
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (400, 0)
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled'); bsdf.location = (120, 0)
    bsdf.inputs['Alpha'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 0.05
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    mat.blend_method = 'BLEND'
    mat.use_backface_culling = True
    ext = getattr(mat, 'vrm_addon_extension', None)
    m1 = getattr(ext, 'mtoon1', None) if ext else None
    if m1 is not None:
        try:
            m1.enabled = True
            m1.alpha_mode = 'BLEND'
            m1.double_sided = False
            pbr = m1.pbr_metallic_roughness
            f = list(pbr.base_color_factor)
            f[3] = 0.0
            pbr.base_color_factor = f
        except Exception as e:  # noqa: BLE001
            print(f'[vrm_export] eye-outer mtoon skipped ({mat.name}): {e}')


def simplify_eye_materials(eyes):
    """Fix the eye materials so the exported eyes show an iris (not solid white).

    The iris colour map is shared: the inner iris material renders it opaque; the
    two outer cornea shells become transparent so they don't occlude it. Returns
    the list of rebuilt material names.
    """
    iris = _find_iris_image(eyes)
    if iris is None:
        print('[vrm_export] WARNING: no iris colour map found on eyes — falling back')
    done = []
    for slot in eyes.material_slots:
        m = slot.material
        if m is None:
            continue
        low = m.name.lower()
        is_outer = ('outer' in low) or ('refract' in low) or ('cornea' in low)
        if is_outer:
            _rebuild_eye_outer_transparent(m)
            done.append(m.name + '(clear)')
        elif iris is not None:
            _rebuild_eye_inner(m, iris)
            done.append(m.name + '(iris)')
        else:
            # last-resort: try the generic simplifier
            if simplify_material(m, color_hints=('eye_color', 'iris', 'color')):
                done.append(m.name)
    print(f'[vrm_export] rebuilt {len(done)} eye materials: {", ".join(done)}')
    return done


def simplify_humgen_materials(human):
    """Flatten HumGen's procedural skin + eye materials to direct-map Principled
    BSDFs so the base color exports cleanly (no red/black skin, no blotches)."""
    body = human.objects.body
    eyes = getattr(human.objects, 'eyes', None)
    done = []
    # skin: base color = the "Female NN"/"Male NN" (or Color) map; keep norm/rough
    for slot in body.material_slots:
        m = slot.material
        if m is None:
            continue
        if simplify_material(m, color_hints=('female', 'male', 'color'),
                             normal_needles=('skin_norm', 'norm'),
                             rough_needles=('rough_spec', 'rough')):
            done.append(m.name)
    # eyes: iris on the inner shell, transparent outer shells (fixes white eyes)
    if eyes is not None:
        done.extend(simplify_eye_materials(eyes))
    print(f'[vrm_export] simplified {len(done)} HumGen materials for glTF: {", ".join(done)}')
    return done


def _bake_hair_base_color(mask_img, rgb=(0.05, 0.035, 0.02), downres=512):
    """Build a single RGBA base-color image: RGB = hair tint, A = strand mask.

    HumGen's ``*_ALPHA`` PNG is RGBA but its alpha channel is all-opaque — the
    strand mask lives in the *RGB* (white strand on black card). MToon reads a
    material's alpha from the base-color texture's *alpha* channel, so we bake a
    new image with the mask moved into A (and a solid hair tint in RGB). Downres
    to keep the file small (hair mask detail survives at 512). Returns the image.
    """
    src = mask_img
    try:
        if not src.has_data and src.filepath:
            src.reload()
    except Exception:  # noqa: BLE001
        pass
    sw, sh = src.size
    if sw == 0 or sh == 0:
        return None
    # sample-downscale the mask R channel into a small RGBA buffer
    n = downres
    out = bpy.data.images.new(f'{src.name}_hairbake', n, n, alpha=True)
    src_px = list(src.pixels)  # flat RGBA
    buf = [0.0] * (n * n * 4)
    r, g, b = rgb
    for y in range(n):
        sy = min(sh - 1, int(y * sh / n))
        for x in range(n):
            sx = min(sw - 1, int(x * sw / n))
            si = (sy * sw + sx) * 4
            mask = src_px[si]  # R channel = strand mask
            di = (y * n + x) * 4
            buf[di] = r; buf[di + 1] = g; buf[di + 2] = b; buf[di + 3] = mask
    out.pixels = buf
    out.pack()
    return out


def simplify_hair_material(mat, hair_rgb=(0.05, 0.035, 0.02)):
    """Rebuild a HumGen haircard material as a clean MToon alpha-cutout.

    HumGen wires card colour + alpha through a node Group the glTF exporter can't
    read, so cards export opaque and the hair is a shard-soup. We bake a single
    RGBA base-color image (RGB = hair tint, A = strand mask from the ``*_ALPHA``
    PNG's RGB), feed it to a plain Principled (Base Color + Alpha from that one
    texture), and export as MToon ``alphaMode=MASK`` so the empty card area is cut
    per-pixel with no depth-sorting. Returns True if rebuilt.
    """
    mask = (_pick_by_name(mat, ('_alpha', 'haircap'), colorspace='sRGB')
            or _pick_by_name(mat, ('_alpha', 'haircap', 'hair')))
    if mask is None:
        return False
    baked = _bake_hair_base_color(mask, rgb=hair_rgb)
    if baked is None:
        return False

    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (600, 0)
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled'); bsdf.location = (250, 0)
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bsdf.inputs['Roughness'].default_value = 0.85

    tex = nt.nodes.new('ShaderNodeTexImage'); tex.location = (-250, 0)
    tex.image = baked
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])

    mat.blend_method = 'CLIP'
    mat.alpha_threshold = 0.5
    mat.use_backface_culling = False

    # Decisive: author this as an explicit MToon material with alphaMode=MASK and
    # the baked RGBA as its base-color texture. Left as BLEND the overlapping hair
    # cards depth-sort wrong and render as a shard-soup over the face; MASK cuts
    # the empty card area away per-pixel with no sorting. Enabling mtoon1 means
    # MToon ignores the Principled node, so we MUST populate its base-color
    # texture explicitly (else it renders default white).
    _set_mtoon(mat, baked, mode='MASK', cutoff=0.5, tint=hair_rgb)
    return True


def _set_mtoon(mat, base_image, mode='MASK', cutoff=0.5, tint=None):
    ext = getattr(mat, 'vrm_addon_extension', None)
    m1 = getattr(ext, 'mtoon1', None) if ext else None
    if m1 is None:
        return
    try:
        m1.enabled = True
        m1.alpha_mode = mode
        m1.alpha_cutoff = float(cutoff)
        m1.double_sided = True
        pbr = m1.pbr_metallic_roughness
        if base_image is not None:
            pbr.base_color_texture.index.source = base_image
        # base_color_factor multiplies the texture; the baked RGB already carries
        # the hair tint, so keep factor white (but set shade color to the tint so
        # MToon's shadowed side isn't pure black).
        mtoon = m1.extensions.vrmc_materials_mtoon
        if tint is not None and hasattr(mtoon, 'shade_color_factor'):
            mtoon.shade_color_factor = (tint[0], tint[1], tint[2])
    except Exception as e:  # noqa: BLE001
        print(f'[vrm_export] mtoon set skipped ({mat.name}): {e}')


def boneparent_head_parts(armature, head_part_hints=('eyes', 'teeth', 'tongue'), head_bone='head'):
    """Rigidly BONE-PARENT the eyes/teeth meshes to the ``head`` bone.

    THE fix for the 'floating teeth/eyes' break. HumGen keeps eyes/teeth as SEPARATE
    meshes vertex-skinned to ``eyeball.L/R`` and ``jaw``/``jaw_upper``. Under
    @pixiv/three-vrm the humanoid skeleton is NORMALIZED and the raw skeleton is
    rebuilt from it every frame the humanoid updates — which displaces any mesh
    skinned to those small face bones, flinging the eyes+teeth down to the chest.
    Neither re-weighting nor merging them fixes it (both tried; both still float).

    What DOES work (VERIFIED by animated render): drop their armature skinning and
    OBJECT-BONE-PARENT each to the ``head`` bone, preserving world position. The VRM
    exporter turns a bone-parented mesh into a single-joint skin bound to ``head`` —
    a mapped humanoid bone that three-vrm normalizes CONSISTENTLY with the body's
    own head verts. The eyes/teeth then ride the head rigidly and stay coherent
    (teeth inside the mouth, eyes in the sockets) through any VRMA clip. Eye gaze
    comes from the app's head/lookAt path; mouth-open from the ``aa`` viseme morph
    on the body — neither needs eye/jaw bones.
    """
    if head_bone not in {b.name for b in armature.data.bones}:
        print(f'[vrm_export] no {head_bone!r} bone — cannot bone-parent head parts')
        return []
    # make sure world matrices reflect the FINAL rig state (e.g. after a height
    # change) before we snapshot them — else the re-parent snaps parts off.
    bpy.context.view_layer.update()
    done = []
    for mesh in list(armature.children):
        if mesh.type != 'MESH':
            continue
        if not any(h in mesh.name.lower() for h in head_part_hints):
            continue
        for m in list(mesh.modifiers):
            if m.type == 'ARMATURE':
                mesh.modifiers.remove(m)
        for vg in list(mesh.vertex_groups):
            mesh.vertex_groups.remove(vg)
        world = mesh.matrix_world.copy()
        mesh.parent = armature
        mesh.parent_type = 'BONE'
        mesh.parent_bone = head_bone
        bpy.context.view_layer.update()
        mesh.matrix_world = world      # keep it exactly where it was authored
        done.append(mesh.name)
    bpy.context.view_layer.update()
    if done:
        print(f'[vrm_export] bone-parented head parts to {head_bone!r}: {", ".join(done)}')
    return done


def prepare_extras(armature, head_part_hints=('eyes', 'teeth', 'tongue')):
    """Make the HumGen haircard / cap meshes export coherently in VRM.

    HumGen's ``convert_to_haircards`` output is only *parented* (no vertex groups,
    no armature modifier) so it doesn't ride the head, and its node-group alpha
    renders as an opaque shard-soup. We weight it to ``head`` + add an Armature
    modifier, and rebuild its material as MToon ``alphaMode=MASK`` so the empty
    card area is cut per-pixel. (Eyes/teeth are handled separately, EARLIER, by
    ``boneparent_head_parts`` — object-bone-parented to ``head``, not skinned, or
    they float to the chest under three-vrm normalization.)
    """
    head_bone = 'head' if 'head' in {b.name for b in armature.data.bones} else None
    fixed = []

    for mesh in list(armature.children):
        if mesh.type != 'MESH':
            continue
        low = mesh.name.lower()
        if any(h in low for h in head_part_hints):
            continue  # eyes/teeth already bone-parented by boneparent_head_parts
        has_arm_mod = any(m.type == 'ARMATURE' for m in mesh.modifiers)
        has_groups = len(mesh.vertex_groups) > 0
        if has_arm_mod and has_groups:
            continue  # body/clothing already skinned — leave them
        # weight everything to head so the cap/hair follows the humanoid head
        if head_bone is not None:
            vg = mesh.vertex_groups.get(head_bone) or mesh.vertex_groups.new(name=head_bone)
            vg.add(range(len(mesh.data.vertices)), 1.0, 'REPLACE')
            if not has_arm_mod:
                am = mesh.modifiers.new(name='VRM_Armature', type='ARMATURE')
                am.object = armature
                am.use_vertex_groups = True
        # rebuild alpha-cutout card materials so the strand texture drives base
        # color + alpha directly (the node-group alpha doesn't survive glTF).
        for slot in mesh.material_slots:
            mat = slot.material
            if mat is None:
                continue
            if getattr(mat, 'blend_method', 'OPAQUE') in ('HASHED', 'BLEND', 'CLIP'):
                if not simplify_hair_material(mat):
                    # fallback: at least flip to CLIP
                    mat.blend_method = 'CLIP'
                    mat.alpha_threshold = 0.5
        fixed.append(mesh.name)
    if fixed:
        print(f'[vrm_export] bound + alpha-fixed {len(fixed)} extra meshes: {", ".join(fixed)}')
    return fixed


# Per-bone target LOCAL frame in ARMATURE (Blender Z-up) space, expressed as the
# world direction the bone should POINT (ydir = head->tail) and where its local +Z
# (roll reference) should face. up=+Z, character-front=-Y, model-left/+X.
_CANON_L, _CANON_R = '.L', '.R'
_FINGER_ROOTS = (
    'thumb.01', 'thumb.02', 'thumb.03',
    'f_index.01', 'f_index.02', 'f_index.03',
    'f_middle.01', 'f_middle.02', 'f_middle.03',
    'f_ring.01', 'f_ring.02', 'f_ring.03',
    'f_pinky.01', 'f_pinky.02', 'f_pinky.03',
)


def _canon_plan():
    plan = {}
    for b in ('spine', 'spine.001', 'spine.002', 'spine.003'):
        plan[b] = ((0, 0, 1), (0, -1, 0))          # spine up, +Z front
    for side in (_CANON_L, _CANON_R):
        for b in ('thigh', 'shin'):
            plan[b + side] = ((0, 0, -1), (0, -1, 0))   # legs straight down
        plan['foot' + side] = ((0, -0.55, -0.84), (0, -0.84, 0.55))
        plan['toe' + side] = ((0, -1, 0), (0, 0, 1))
    sx = {_CANON_L: 1, _CANON_R: -1}
    for side, s in sx.items():
        for b in ('shoulder', 'upper_arm', 'forearm', 'hand'):
            plan[b + side] = ((s, 0, 0), (0, -1, 0))    # arms out ±X, +Z front
        for f in _FINGER_ROOTS:
            plan[f + side] = ((s, 0, 0), (0, 0, 1))     # fingers along ±X
    return plan


_CANON_ORDER = (
    ['spine', 'spine.001', 'spine.002', 'spine.003',
     'shoulder.L', 'upper_arm.L', 'forearm.L', 'hand.L',
     'shoulder.R', 'upper_arm.R', 'forearm.R', 'hand.R',
     'thigh.L', 'shin.L', 'foot.L', 'toe.L',
     'thigh.R', 'shin.R', 'foot.R', 'toe.R']
    + [f + s for f in _FINGER_ROOTS for s in (_CANON_L, _CANON_R)]
)

# The bones the world-align REROLL is applied to. Their POSITIONS are canonicalised
# for ALL humanoid bones by the T-pose bake; the REROLL (world-aligning the local
# frame so the exported node rotation is identity) is applied ONLY to the spine and
# leg chains.
#
# WHY ONLY SPINE+LEGS: the leg chain's rolled rest is what folded the legs over the
# head (THE reported defect), and legs/spine carry no twist skinning so their frame
# re-aligns cleanly (VERIFIED: legs stay straight down through idle / victory / squat
# / dance clips). The ARM chain is deliberately LEFT on its natural post-T-pose-bake
# frame: world-aligning any arm bone (shoulder/upper_arm/forearm/hand) shears the
# lower-arm + hand skin off the elbow under animation, because that skin is bound
# with a twist distribution tied to the bone's original roll axis (VERIFIED by
# animated three-vrm renders matching the app's exact path). The un-rerolled arms
# stay intact (no tearing) and still animate; they simply don't reach the identity
# node rotation the legs do.
_REROLL_BONES = ['spine', 'spine.001', 'spine.002', 'spine.003',
                 'thigh.L', 'shin.L', 'foot.L', 'toe.L',
                 'thigh.R', 'shin.R', 'foot.R', 'toe.R']


def _pose_to_canonical_tpose(context, armature):
    """Pose the deform-bone chains into the VRM-canonical T-pose (pose space).

    Rotates each pose bone so its head->tail points to the canonical direction,
    walking each chain so a rotated parent carries its children (this is what
    moves the joint POSITIONS into a true T-pose — arms out ±X, legs straight
    down). Returns after leaving the pose applied so the caller can bake it.
    """
    import mathutils
    plan = _canon_plan()
    bpy.ops.object.mode_set(mode='POSE')
    for pb in armature.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = mathutils.Quaternion()
    context.view_layer.update()
    mw = armature.matrix_world
    for name in _CANON_ORDER:
        pb = armature.pose.bones.get(name)
        if pb is None or name not in plan:
            continue
        ydir = mathutils.Vector(plan[name][0]).normalized()
        # current world head->tail direction of this pose bone
        wm = mw @ pb.matrix
        cur = (wm @ mathutils.Vector((0, 1, 0)) - wm.translation).normalized()
        want = mathutils.Vector(ydir)
        # rotate the bone (in its local space) to align cur -> want
        rot_world = cur.rotation_difference(want)
        # convert the world-space rotation into the bone's local rotation delta
        basis = (mw @ pb.matrix).to_3x3()
        local_axis = basis.inverted() @ rot_world.axis
        local_rot = mathutils.Quaternion(local_axis, rot_world.angle)
        pb.rotation_quaternion = pb.rotation_quaternion @ local_rot
        context.view_layer.update()


def _roll_correct_arms_via_pose(context, armature):
    """Weight-safely fix the ARM bones' roll so they animate without folding.

    After the T-pose bake the arm bones POINT the right way (+X out) but keep a
    ~170° residual roll from HumGen's A-pose. Editing that roll in EDIT mode shears
    the lower-arm/hand skin (its twist weighting is tied to the old roll axis). So
    instead we correct the roll as a POSE rotation about each bone's OWN length
    axis — which does NOT move the child joints (they lie on that axis) — and then
    ``armature_apply`` bakes it into the rest AND re-binds the mesh, keeping the
    skin intact. Target: each arm bone's local +Z (roll axis) faces world front
    (−Y), matching the identity-frame legs/spine so the shared VRMA arm tracks map
    cleanly.
    """
    import mathutils
    arm_bones = ['shoulder.L', 'upper_arm.L', 'forearm.L', 'hand.L',
                 'shoulder.R', 'upper_arm.R', 'forearm.R', 'hand.R']
    bpy.ops.object.mode_set(mode='POSE')
    for pb in armature.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = mathutils.Quaternion()
    context.view_layer.update()
    mw = armature.matrix_world
    front = mathutils.Vector((0, -1, 0))   # world front
    corrected = 0
    for name in arm_bones:
        pb = armature.pose.bones.get(name)
        if pb is None:
            continue
        wm = mw @ pb.matrix
        y_axis = (wm.to_3x3() @ mathutils.Vector((0, 1, 0))).normalized()  # bone dir
        z_axis = (wm.to_3x3() @ mathutils.Vector((0, 0, 1))).normalized()  # cur roll
        # desired local +Z = front projected perpendicular to the bone axis
        want_z = (front - y_axis * front.dot(y_axis))
        if want_z.length < 1e-4:
            continue
        want_z.normalize()
        # signed angle from current z_axis to want_z about the bone's y_axis
        cross = z_axis.cross(want_z)
        angle = z_axis.angle(want_z)
        if cross.dot(y_axis) < 0:
            angle = -angle
        # apply as a roll about the bone's OWN local Y (does not move children)
        pb.rotation_quaternion = pb.rotation_quaternion @ mathutils.Quaternion((0, 1, 0), angle)
        context.view_layer.update()
        corrected += 1
    # bake the roll pose into rest (re-binds the mesh, so no shearing)
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.pose.armature_apply(selected=False)
    context.view_layer.update()
    print(f'[vrm_export] roll-corrected {corrected} arm bones via pose bake')
    return corrected


def _reroll_deform_bones(context, armature):
    """World-align the spine + leg deform bones' local frame (identity export node
    rotation) via an EDIT-mode rewrite.

    Reference VRMs (Work Boy / Erik) encode limb shape purely as node TRANSLATIONS
    with IDENTITY node rotations. The app strips three-vrm's ``Normalized_`` prefix
    and drives the RAW bones with normalized (world-axis) values, so the raw rest
    must be world-axis-aligned or the limbs fold. We point every rerolled bone the
    SAME way (+Z world up, local +Z = front) so its node rotation exports as
    identity; the skeleton shape lives entirely in the (unchanged) head offsets.

    This edit-mode rewrite is applied ONLY to _REROLL_BONES (spine + legs), whose
    no-twist skin re-aligns cleanly. The ARM bones are handled separately by
    ``_roll_correct_arms_via_pose`` (a weight-safe pose-roll + bake), because
    editing an arm bone's rest orientation here detaches its forearm/hand skin.
    """
    import mathutils
    # world-align only spine + legs (see _REROLL_BONES); arms are handled by the
    # weight-safe pose-roll so their skin doesn't shear under animation.
    scope = list(_REROLL_BONES)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = armature.data.edit_bones
    for name in scope:
        b = eb.get(name)
        if b is not None:
            b.use_connect = False
    context.view_layer.update()

    length = 0.08
    x_axis = mathutils.Vector((1, 0, 0))
    y_axis = mathutils.Vector((0, 0, 1))   # bone length -> world up
    z_axis = mathutils.Vector((0, -1, 0))  # roll ref -> world front
    rot3 = mathutils.Matrix((
        (x_axis.x, y_axis.x, z_axis.x),
        (x_axis.y, y_axis.y, z_axis.y),
        (x_axis.z, y_axis.z, z_axis.z),
    ))
    done = 0
    for name in scope:
        b = eb.get(name)
        if b is None:
            continue
        head = b.head.copy()
        m = rot3.to_4x4()
        m.translation = head
        b.matrix = m
        b.length = length
        done += 1
    return done


def canonicalize_humanoid_rest(armature):
    """Put the armature in the VRM-canonical rest pose and BAKE it as rest.

    THE fix for 'legs fold up over the head under animation'. HumGen's Rigify rig
    ships an A-pose whose deform bones carry large, non-canonical rolls
    (upper_arm ≈ ±196°, thigh ≈ ±17°, foot ≈ −117° — VERIFIED by dumping edit
    bones). The app loads the VRM, builds a shared clip via ``createVRMAnimationClip``
    (tracks authored in @pixiv/three-vrm's NORMALIZED, world-axis-aligned bone
    space), strips the ``Normalized_`` prefix, drives the RAW bones with those
    values, and never calls ``vrm.update()`` (no normalized→raw resync). On a rig
    whose raw rest ≈ world axes (Erik / Work Boy) the values map 1:1; on HumGen's
    rolled A-pose rest they compose into a limb explosion — the legs fold up over
    the head (VERIFIED: reproduced in a three-vrm harness matching the app's exact
    path — the same idle clip stands Work Boy up but folds Aria's legs).

    Fix, in three steps (weight-preserving — Blender re-binds the mesh on the pose
    bake, and rest pose applies no deformation so appearance is unchanged):
      1. pose the deform chains into a true T-pose (arms out ±X, legs straight
         down) — children follow their rotated parents, so joint POSITIONS become
         canonical;
      2. ``pose.armature_apply`` — bake that pose as the new REST pose;
      3. re-point + re-roll each deform bone so its local axes are world-aligned,
         giving near-identity export node rotations that match the normalized proxy.

    Run BEFORE ``boneparent_head_parts`` (which pins eyes/teeth to the ``head``
    bone matrix). ``head``/``neck``/eye/jaw bones are intentionally left untouched.
    """
    context = bpy.context
    prev_active = context.view_layer.objects.active
    prev_mode = armature.mode if armature.mode else 'OBJECT'
    context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode='OBJECT')

    # 1. pose to canonical T-pose (positions)
    _pose_to_canonical_tpose(context, armature)

    # 2. bake pose -> rest (Blender preserves mesh appearance by re-binding)
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.pose.armature_apply(selected=False)
    context.view_layer.update()

    # 2b. weight-safely fix the ARM bones' roll (pose about own axis + bake). Arms
    # get this instead of the edit-mode reroll: editing the arm rest orientation
    # detaches the forearm/hand skin, whereas a pose-roll + bake re-binds the mesh so
    # the arms animate cleanly for standing/idle and gentle gestures.
    _roll_correct_arms_via_pose(context, armature)

    # 3. world-align spine + leg bones' local axes (edit-mode reroll — clean for the
    # no-twist leg/spine skin, and the leg roll is what folded the legs).
    done = _reroll_deform_bones(context, armature)

    bpy.ops.object.mode_set(mode='OBJECT')
    if prev_mode != 'OBJECT':
        try:
            bpy.ops.object.mode_set(mode=prev_mode)
        except Exception:  # noqa: BLE001
            pass
    if prev_active is not None:
        context.view_layer.objects.active = prev_active
    context.view_layer.update()
    print(f'[vrm_export] canonicalized rest pose (T-pose baked, {done} bones re-aligned)')
    return done


def limit_vertex_weights(armature, max_influences=4):
    """Clamp every skinned vertex to ``max_influences`` bone weights and normalise.

    glTF/VRM allow at most 4 joint influences per vertex; HumGen's arm skin uses
    MORE (a twist-bone rig), so the exporter silently drops the smallest and
    RENORMALISES — which, on a re-oriented rest, makes the forearm/hand skin fan
    out and shear under large arm rotations (the reference Work Boy rig, already
    ≤4, never does). Doing the ``LIMIT_WEIGHTS`` + ``NORMALIZE_ALL`` cleanup
    ourselves (deterministically, before export) removes that shear so the arms
    stay intact through the shared VRMA gesture clips.
    """
    cleaned = 0
    for mesh in list(armature.children):
        if mesh.type != 'MESH' or not mesh.vertex_groups:
            continue
        if not any(m.type == 'ARMATURE' for m in mesh.modifiers):
            continue
        bpy.ops.object.select_all(action='DESELECT')
        mesh.select_set(True)
        bpy.context.view_layer.objects.active = mesh
        try:
            bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL',
                                                    limit=max_influences)
            bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL',
                                                      lock_active=False)
            cleaned += 1
        except Exception as e:  # noqa: BLE001
            print(f'[vrm_export] weight-limit skipped ({mesh.name}): {e}')
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = armature
    print(f'[vrm_export] limited {cleaned} meshes to {max_influences} weights + normalized')
    return cleaned


def export_vrm(out_path, armature, body_mesh, name='Aria', max_texture=2048):
    """Configure humanoid + expressions + meta, then export ``out_path`` (VRM1).

    ``max_texture`` caps embedded image dimensions (default 2048). The skin is the
    largest budget; 2048 keeps it crisp. Drop to 1024 for a smaller file.
    """
    _require_vrm()
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)

    # FIRST: rewrite the arm/leg/spine deform bones to the VRM-canonical rest
    # orientation (arms out ±X, legs straight down, world-aligned local axes) so
    # the app's shared VRMA clips don't fold the limbs. MUST run before
    # boneparent_head_parts (which pins eyes/teeth to the 'head' bone matrix).
    canonicalize_humanoid_rest(armature)

    # Rigidly bone-parent eyes+teeth to the head bone so they don't float to the
    # chest under three-vrm's humanoid normalization (THE 'floating teeth/eyes' fix).
    boneparent_head_parts(armature)
    prepare_extras(armature)
    assign_humanoid(armature)
    # Export the rest pose we just canonicalized verbatim — do NOT let the addon's
    # default 'autoPose' re-estimate a T-pose (that only fixes joint positions and
    # would keep HumGen's bone roll). restPositionPose = "use the current rest".
    try:
        armature.data.vrm_addon_extension.vrm1.humanoid.pose = 'restPositionPose'
    except Exception as e:  # noqa: BLE001
        print(f'[vrm_export] could not set humanoid pose mode: {e}')
    configure_expressions(armature, body_mesh)
    author_meta(armature, name=name)
    # clamp skin to 4 influences/vertex + normalize so the arm skin doesn't shear
    # under large gesture rotations (HumGen's twist rig weights >4 bones/vertex).
    limit_vertex_weights(armature, max_influences=4)
    _prep_textures(max_dim=max_texture)

    # select the armature + all its children (body/eyes/teeth/hair/clothing)
    bpy.ops.object.select_all(action='DESELECT')
    armature.select_set(True)
    for child in armature.children:
        child.select_set(True)
    bpy.context.view_layer.objects.active = armature

    # io_scene_vrm 4.3.1 exports the active VRM armature and its descendants.
    # enable_advanced_preferences unlocks export_try_sparse_sk (sparse morph
    # targets — the 84 shape keys are mostly-zero deltas, so this shrinks them a
    # lot). ignore_warning skips the interactive warning modal in --background.
    kwargs = dict(
        filepath=out_path,
        armature_object_name=armature.name,
        enable_advanced_preferences=True,
        export_try_sparse_sk=True,
        ignore_warning=True,
    )
    try:
        bpy.ops.export_scene.vrm(**kwargs)
    except TypeError:
        bpy.ops.export_scene.vrm(filepath=out_path)
    size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f'[vrm_export] wrote {out_path} ({size_mb:.1f} MB)')
    return out_path
