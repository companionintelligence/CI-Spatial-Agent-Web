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
    # eyes: base color = the eye color map
    if eyes is not None:
        for slot in eyes.material_slots:
            m = slot.material
            if m is None:
                continue
            if simplify_material(m, color_hints=('eye_color', 'iris', 'color'),
                                 normal_needles=('eye_normal', 'normal'),
                                 rough_needles=('rough',)):
                done.append(m.name)
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


def export_vrm(out_path, armature, body_mesh, name='Aria', max_texture=2048):
    """Configure humanoid + expressions + meta, then export ``out_path`` (VRM1).

    ``max_texture`` caps embedded image dimensions (default 2048). The skin is the
    largest budget; 2048 keeps it crisp. Drop to 1024 for a smaller file.
    """
    _require_vrm()
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)

    # Rigidly bone-parent eyes+teeth to the head bone so they don't float to the
    # chest under three-vrm's humanoid normalization (THE 'floating teeth/eyes' fix).
    boneparent_head_parts(armature)
    prepare_extras(armature)
    assign_humanoid(armature)
    configure_expressions(armature, body_mesh)
    author_meta(armature, name=name)
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
