"""Strategy D — re-skin the HumGen body onto the RPM skeleton.

The HumGen human ships a Rigify-derived rig whose deform bones are named
``spine.001``/``upper_arm.L``/``thigh.L`` … . The app expects the RPM/Mixamo
skeleton (``Hips/Spine/Spine1/Spine2/Neck/Head/LeftEye/RightEye`` + the standard
RPM arm/leg/hand chain) so the 34 shared GLB clips play natively and the GLB
head-finder / gaze service resolve their bones by name.

Strategy D (full re-skin):

  1. Import the RPM T-pose GLB — it carries both the RPM armature AND a real
     skinned reference body (``Wolf3D_Avatar``: 7415 verts, 82 RPM-named vertex
     groups). VERIFIED against the in-tree ``rpm-mixamo-t-posed.glb`` (Anselm).
  2. Align the HumGen body to the RPM armature (both are ~1.8 m, metres, standing
     at the origin; a height/hip match refines it).
  3. Transfer skin weights from the RPM reference mesh onto the HumGen body with a
     Data Transfer modifier (VGROUP_WEIGHTS, nearest-face-interpolated), which
     creates RPM-named vertex groups on the HumGen mesh.
  4. Parent the HumGen body to the RPM armature via an Armature modifier and drop
     the RPM reference mesh + the HumGen native rig.

Shape keys (ARKit + visemes) are preserved throughout — Data Transfer of vertex
weights and the Armature modifier do not touch shape keys, and we never apply a
geometry-changing modifier.

Runs under ``blender --background``.
"""

import os

try:
    import bpy
except ImportError:  # allow import outside Blender (docs/lint)
    bpy = None

from mappings import RPM_BONES, RPM_CONTRACT_BONES  # noqa: E402


# The in-tree RPM T-pose reference rig (Anselm) — carries the exact RPM armature
# AND a real skinned reference mesh to transfer weights from. This is the rig the
# app's shared GLB animation clips target. Canonical avatars now live in the
# top-level ``assets/avatars/`` (scripts/pack-assets.mjs copies them into each app
# at build); the legacy ``apps/web/public/assets/avatars/`` is a fallback for older
# checkouts.
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def _resolve_rpm_reference():
    candidates = [
        os.path.join(_REPO_ROOT, 'assets', 'avatars', 'rpm-mixamo-t-posed.glb'),
        os.path.join(_REPO_ROOT, 'apps', 'web', 'public', 'assets', 'avatars',
                     'rpm-mixamo-t-posed.glb'),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return candidates[0]  # canonical location for the error message


RPM_REFERENCE_GLB = _resolve_rpm_reference()

# Fallback: the animation-library T-poses (armature only — their mesh is a
# placeholder Icosphere, so they can't be a weight-transfer source; kept for the
# armature if the in-tree reference is unavailable).
RPM_LIBRARY = '/Users/liam/devel/3d/animation-library-master'
RPM_TPOSE_FALLBACK = {
    'male':   os.path.join(RPM_LIBRARY, 'masculine', 'glb', 'Masculine_TPose.glb'),
    'female': os.path.join(RPM_LIBRARY, 'feminine',  'glb', 'Feminine_TPose.glb'),
}


def _require_bpy():
    if bpy is None:
        raise RuntimeError('skeleton.py must run inside Blender (bpy unavailable)')


def import_rpm_reference():
    """Import the RPM T-pose GLB. Returns (armature, reference_mesh).

    ``reference_mesh`` is the real skinned RPM body (``Wolf3D_Avatar``) used as the
    weight-transfer source; the placeholder Icosphere is discarded.
    """
    _require_bpy()
    path = RPM_REFERENCE_GLB
    if not os.path.exists(path):
        raise FileNotFoundError(f'RPM reference GLB not found: {path}')

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [o for o in bpy.data.objects if o not in before]

    armature = next((o for o in imported if o.type == 'ARMATURE'), None)
    if armature is None:
        raise RuntimeError(f'no armature in RPM reference GLB: {path}')

    meshes = [o for o in imported if o.type == 'MESH']
    # the real skinned body has the most vertices + vertex groups (Icosphere has 0)
    ref_mesh = None
    skinned = [m for m in meshes if len(m.vertex_groups) > 0]
    if skinned:
        ref_mesh = max(skinned, key=lambda m: len(m.data.vertices))
    # drop every imported mesh except the chosen reference
    for m in meshes:
        if m is not ref_mesh:
            bpy.data.objects.remove(m, do_unlink=True)

    if ref_mesh is None:
        raise RuntimeError(
            f'no skinned reference mesh in {path} — cannot transfer weights. '
            f'Strategy D needs a real RPM body mesh (Wolf3D_Avatar).'
        )

    _assert_rpm_bones(armature)
    armature.name = 'RPM_Armature'
    return armature, ref_mesh


def _assert_rpm_bones(armature):
    """Fail fast if the imported armature isn't the expected RPM rig."""
    names = {b.name for b in armature.data.bones}
    missing = [b for b in RPM_CONTRACT_BONES if b not in names]
    if missing:
        raise RuntimeError(
            f'imported armature is missing RPM contract bones {missing}; '
            f'got {sorted(names)[:12]}...'
        )


def find_humgen_armature(exclude):
    """Return the HumGen rig armature (the armature that is not ``exclude``)."""
    _require_bpy()
    for o in bpy.data.objects:
        if o.type == 'ARMATURE' and o is not exclude:
            return o
    return None


def find_body_mesh(humgen_rig):
    """Return the HumGen body mesh (largest mesh skinned to the HG rig)."""
    _require_bpy()
    candidates = [o for o in bpy.data.objects
                  if o.type == 'MESH' and o.find_armature() is humgen_rig]
    if not candidates:
        candidates = [o for o in bpy.data.objects
                      if o.type == 'MESH' and o.parent is humgen_rig]
    if not candidates:
        raise RuntimeError('could not locate HumGen body mesh')
    return max(candidates, key=lambda m: len(m.data.vertices))


def _align_body_to_rpm(body, rpm_armature, ref_mesh, extras=None):
    """Scale + place the HumGen body (and clothing) to match the RPM *reference
    mesh* silhouette so head-relative framing matches the RPM avatars.

    CRITICAL FRAMING FIX: the previous version scaled the body to the RPM
    *armature*'s ``dimensions.z`` (1.867 m). That number is inflated by the RPM
    leaf/end bones (``HeadTop_End`` reaches z≈1.966), so the body came out ~1.94 m
    tall while its Head/eye BONES stayed at RPM height (Head bone y≈1.557, eyes
    y≈1.634). The result: the face geometry floated ~0.2 m ABOVE the eye bones, so
    a camera aimed at the Head bone framed the neck/chin instead of the face, and
    the head read oversized versus the other RPM avatars.

    The fix scales the body so its total height matches the RPM reference BODY
    MESH (``Wolf3D_Avatar`` ≈ 1.826 m — the same silhouette every shipping RPM
    avatar uses), NOT the armature bone extent. The crown then lands at ~1.826 m
    and the face sits at the RPM eye-bone height, framing identically to the RPM
    avatars. We always correct (no dead-band) because the residual mismatch (~10%)
    is exactly what broke framing before. Clothing meshes (``extras``) are scaled
    by the same factor about the same pivot so they keep fitting the body.

    Both meshes are authored standing at the origin in metres; after scaling we
    translate so the feet (min Z) sit on the floor (min Z of the reference mesh).
    """
    _require_bpy()
    bpy.context.view_layer.update()
    movers = [body] + list(extras or [])

    # Use WORLD-SPACE vertex extents, not object.dimensions — after height.set()
    # HumGen's body.dimensions.z is unreliable (it read ~1.66 while the mesh crown
    # was actually at ~1.80). The framing that matters is the crown-to-floor span
    # measured from the real vertices.
    def _z_extent(obj):
        zs = [(obj.matrix_world @ v.co).z for v in obj.data.vertices]
        return min(zs), max(zs)

    body_min_z, body_crown = _z_extent(body)
    body_h = body_crown - body_min_z

    if ref_mesh is not None:
        ref_min_z, ref_crown = _z_extent(ref_mesh)
        target_h = ref_crown - ref_min_z
        ref_floor = ref_min_z
    else:
        # armature-only fallback (no reference mesh): use bone extent + floor at 0
        target_h = rpm_armature.dimensions.z
        ref_floor = rpm_armature.matrix_world.translation.z

    if body_h > 1e-4 and target_h > 1e-4:
        scale = target_h / body_h
        if abs(scale - 1.0) > 1e-3:  # always correct — framing depends on it
            # Scale every mesh about the SAME world pivot (the origin), NOT each
            # object's own origin. The body, eyes, teeth and clothing have different
            # object origins; scaling each via `obj.scale` alone pivots about its own
            # origin and desyncs them (the eyeballs drifted ~9 cm below the sockets).
            # Scaling about the world origin means location *= scale as well.
            for m in movers:
                m.scale = tuple(s * scale for s in m.scale)
                m.location = tuple(c * scale for c in m.location)
            bpy.context.view_layer.update()
            print(f'[skeleton] scaled body+clothing by {scale:.4f} about world origin '
                  f'(HG crown-to-floor {body_h:.3f} m -> RPM ref {target_h:.3f} m)')

    # align feet (min Z) to the reference mesh's floor so the crown lands at the
    # RPM crown height and the face sits at the RPM eye-bone height. A single global
    # dz shifts every mesh equally, preserving their relative placement.
    bpy.context.view_layer.update()
    body_min_z, _ = _z_extent(body)
    dz = ref_floor - body_min_z
    if abs(dz) > 1e-3:
        for m in movers:
            m.location.z += dz
        bpy.context.view_layer.update()
        print(f'[skeleton] shifted body+clothing Z by {dz:.3f} to align feet')


def _rpm_reskin_mesh(mesh, rpm_armature, ref_mesh, label='mesh'):
    """Core Strategy-D re-skin for a single mesh: Data-Transfer RPM weights from
    ``ref_mesh`` onto ``mesh``, prune non-RPM groups, bind to the RPM armature.

    Shared by the body and every clothing/footwear mesh so they all ride the RPM
    skeleton identically. Vertex-group data transfer changes no geometry, so it is
    safe on shape-keyed meshes (clothing carries corrective shape keys).
    """
    _require_bpy()

    # 0. clear the old HG armature modifier and any leftover MASK modifiers. (The
    #    body's clothing masks are already stripped before baking so the full body
    #    is baked + kept; this just guards against any residual mask modifier.)
    for mod in list(mesh.modifiers):
        if mod.type in {'ARMATURE', 'MASK'}:
            mesh.modifiers.remove(mod)

    # 1. ensure a destination vertex group exists for every RPM bone so Data
    #    Transfer (layers_select_dst='NAME') has somewhere to write.
    existing = {vg.name for vg in mesh.vertex_groups}
    for bone in (b.name for b in rpm_armature.data.bones):
        if bone not in existing:
            mesh.vertex_groups.new(name=bone)

    # 2. Data Transfer modifier: nearest-face-interpolated vgroup weights.
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh

    dt = mesh.modifiers.new(name='RPM_WeightTransfer', type='DATA_TRANSFER')
    dt.object = ref_mesh
    dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}
    dt.vert_mapping = 'POLYINTERP_NEAREST'      # nearest-face, interpolated
    dt.layers_vgroup_select_src = 'ALL'
    dt.layers_vgroup_select_dst = 'NAME'        # match by group name
    dt.mix_mode = 'REPLACE'

    try:
        bpy.ops.object.modifier_apply(modifier=dt.name)
        print(f'[skeleton] applied Data Transfer (RPM weights -> {label})')
    except RuntimeError as e:
        # Some builds refuse modifier_apply on shape-keyed meshes; use the operator
        # form which writes directly into vertex groups.
        print(f'[skeleton] modifier_apply refused for {label} ({e}); '
              f'using data_transfer operator')
        mesh.modifiers.remove(dt)
        bpy.ops.object.data_transfer(
            use_reverse_transfer=False,
            data_type='VGROUP_WEIGHTS',
            vert_mapping='POLYINTERP_NEAREST',
            layers_select_src='ALL',
            layers_select_dst='NAME',
            mix_mode='REPLACE',
        )

    # 3. prune vertex groups that aren't RPM bones (HG mask/lip/breast groups etc.)
    rpm_bone_names = {b.name for b in rpm_armature.data.bones}
    for vg in list(mesh.vertex_groups):
        if vg.name not in rpm_bone_names:
            mesh.vertex_groups.remove(vg)

    # 4. bind to the RPM armature
    mesh.parent = rpm_armature
    mesh.matrix_parent_inverse = rpm_armature.matrix_world.inverted()
    arm_mod = mesh.modifiers.new(name='RPM_Armature', type='ARMATURE')
    arm_mod.object = rpm_armature
    arm_mod.use_vertex_groups = True

    kept = len(mesh.vertex_groups)
    print(f'[skeleton] {label} now bound to RPM_Armature with {kept} RPM vertex groups')
    return mesh


# HumGen's clothing geometry-mask vertex groups: an inverted MASK on the body hides
# (we delete) the vertices weighted into these groups. The mask MODIFIERS are removed
# before baking (so the full body bakes), but the GROUPS persist on the mesh.
_CLOTHING_MASK_GROUPS = (
    'mask_torso', 'mask_arms_long', 'mask_arms_short',
    'mask_lower_long', 'mask_lower_short', 'mask_foot',
)


def delete_clothing_masked_geometry(body, clothing_meshes=None, overlap=0.12):
    """DELETE the body geometry covered by clothing, using HumGen's mask vertex groups.

    Runs AFTER the full body is baked (humgen.unmask_body_for_bake stripped the mask
    modifiers pre-bake, so the kept skin — neck, hands, head — is fully textured).
    Here we remove the *covered* torso/arm/leg verts so the body can't poke through
    the clothing (which exposed the baked default underwear + skin as blobs).

    GAP-SAFE: a masked vert is only deleted if it sits at least ``overlap`` metres
    BELOW the top of the nearest covering garment. This keeps a band of neck/shoulder
    skin that tucks UNDER the collar, so no gap opens between the neck and the
    clothing (the mask groups otherwise cut ~2-3 cm above some collars). Deleting in
    EDIT mode preserves the face shape keys.
    """
    _require_bpy()
    vg_by_name = {vg.name: vg for vg in body.vertex_groups}
    present = [n for n in _CLOTHING_MASK_GROUPS if n in vg_by_name]
    if not present:
        return 0

    # Highest garment vertex per side region isn't worth the complexity — a single
    # global clothing top (minus overlap) is a safe floor: never delete body skin
    # that reaches above the top of all clothing, so the collar always overlaps it.
    keep_above = None
    cloth = [m for m in (clothing_meshes or [])
             if m is not None and getattr(m, 'type', None) == 'MESH'
             and m.name in bpy.data.objects]
    if cloth:
        cloth_top = max((m.matrix_world @ v.co).z
                        for m in cloth for v in m.data.vertices)
        keep_above = cloth_top - overlap

    to_delete = set()
    for name in present:
        gi = vg_by_name[name].index
        for v in body.data.vertices:
            if not any(g.group == gi and g.weight > 0.0 for g in v.groups):
                continue
            if keep_above is not None and (body.matrix_world @ v.co).z >= keep_above:
                continue  # keep neck/shoulder skin that tucks under the collar
            to_delete.add(v.index)
    if not to_delete:
        return 0

    del_vg = body.vertex_groups.new(name='__mask_delete__')
    del_vg.add(list(to_delete), 1.0, 'REPLACE')
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='DESELECT')
    body.vertex_groups.active_index = del_vg.index
    bpy.ops.object.vertex_group_select()
    bpy.ops.mesh.delete(type='VERT')
    bpy.ops.object.mode_set(mode='OBJECT')
    if '__mask_delete__' in body.vertex_groups:
        body.vertex_groups.remove(body.vertex_groups['__mask_delete__'])
    print(f'[skeleton] deleted {len(to_delete)} clothing-covered body verts '
          f'({", ".join(present)}) so the body cannot clip through the clothing')
    return len(to_delete)


def transfer_weights(body, rpm_armature, ref_mesh):
    """Transfer RPM skin weights onto the HumGen body and bind to the RPM rig."""
    return _rpm_reskin_mesh(body, rpm_armature, ref_mesh, label='HumGen body')


def reskin_clothing(clothing_meshes, rpm_armature, ref_mesh):
    """Re-skin clothing + footwear meshes onto the RPM skeleton.

    Clothing is loaded skinned to the HumGen rig (HG-named vertex groups like
    ``spine.001`` / ``upper_arm.L``). Strategy D drops that rig, so — exactly like
    the body — we Data-Transfer RPM weights onto each garment from the RPM
    reference body mesh and bind it to the RPM armature. Without this the garments
    would either not deform (no matching bones) or collapse (``merge_extra_meshes``
    would otherwise weight them all to Head).
    """
    _require_bpy()
    done = []
    for m in clothing_meshes:
        if m is None or m.type != 'MESH':
            continue
        _rpm_reskin_mesh(m, rpm_armature, ref_mesh, label=f'clothing:{m.name}')
        done.append(m)
    if done:
        print(f'[skeleton] re-skinned {len(done)} clothing meshes onto RPM_Armature '
              f'({", ".join(m.name for m in done)})')
    return done


def drop_humgen_rig(humgen_rig):
    """Delete the HumGen armature after weights are transferred."""
    _require_bpy()
    if humgen_rig is not None:
        bpy.data.objects.remove(humgen_rig, do_unlink=True)


def _weight_mesh_to_head(mesh, rpm_armature):
    """Bind a small face mesh (eyes/teeth) rigidly to the RPM ``Head`` bone, keeping
    its exact world position.

    The eyes/teeth already sit correctly inside the HumGen head; they only need to
    follow the head bone. We therefore preserve their world transform and rigidly
    bind them to ``Head`` — WITHOUT baking the object matrix into the vertices, which
    is what mis-placed them before (the eyeballs drifted to the throat).

    Steps: clear the HG-rig parent keeping the world transform, weight every vertex
    100% to ``Head``, then parent to the RPM armature with the armature's world
    inverse as parent-inverse (the armature sits at the origin, so the mesh keeps its
    world position). At rest the Head bone deforms by identity, so the mesh stays put;
    when the Head bone animates, the eyes/teeth follow it rigidly.
    """
    _require_bpy()
    for mod in list(mesh.modifiers):
        if mod.type in {'ARMATURE', 'MASK'}:
            mesh.modifiers.remove(mod)

    # Detach from the HG rig but keep the current world position.
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')

    # Weight every vertex fully to Head (drop the HG eyeball.L/R groups first).
    for vg in list(mesh.vertex_groups):
        mesh.vertex_groups.remove(vg)
    head_vg = mesh.vertex_groups.new(name='Head')
    head_vg.add(range(len(mesh.data.vertices)), 1.0, 'REPLACE')

    # Parent to the RPM armature preserving the world transform. matrix_world stays
    # unchanged when matrix_parent_inverse = parent.matrix_world.inverted()
    # (from matrix_world = parent.matrix_world @ mpi @ matrix_basis).
    bpy.context.view_layer.update()
    world = mesh.matrix_world.copy()
    mesh.parent = rpm_armature
    mesh.matrix_parent_inverse = rpm_armature.matrix_world.inverted()
    mesh.matrix_basis = world  # basis == old world, since mpi cancels the armature xf
    am = mesh.modifiers.new(name='RPM_Armature', type='ARMATURE')
    am.object = rpm_armature
    am.use_vertex_groups = True
    bpy.context.view_layer.update()


def merge_extra_meshes(body, rpm_armature, humgen_rig, ref_mesh=None, exclude=None):
    """Re-skin the eyes/teeth meshes onto the RPM rig so they track the face.

    HumGen splits eyes + upper/lower teeth into separate meshes. They sit INSIDE the
    head and must deform EXACTLY like the surrounding body face, or they drift out of
    the sockets/mouth. The body face, after the RPM Data-Transfer re-skin, is weighted
    to a Head/Neck/Spine2 blend (not pure Head) and the RPM bind pose shifts it a few
    cm from its authored rest; a rigid Head bind leaves the eyeballs behind (they sank
    below the sockets). So we give eyes/teeth the SAME Data-Transfer treatment as the
    body — RPM weights sampled from the reference body mesh at their location — so they
    inherit the identical bind and move with the face. Meshes too far from the
    reference surface to get weights fall back to a rigid Head bind.

    ``exclude`` (clothing/footwear meshes) are handled separately by ``reskin_clothing``.
    """
    _require_bpy()
    exclude_set = set(exclude or [])
    extras = [o for o in bpy.data.objects
              if o.type == 'MESH' and o is not body and o not in exclude_set
              and (o.find_armature() is humgen_rig or o.parent is humgen_rig)]
    # Seat the eyes+teeth cluster by ONE shared shift (preserving their relative
    # arrangement) so the eyeballs sit in the deformed sockets and the mouth follows.
    # Then rigidly Head-bind each so they track head motion.
    _seat_face_parts_to_body(extras, body)
    for m in extras:
        _weight_mesh_to_head(m, rpm_armature)
    if extras:
        print(f'[skeleton] seated + Head-bound {len(extras)} face parts '
              f'({", ".join(m.name for m in extras)})')
    return extras


def _seat_face_parts_to_body(parts, body):
    """Re-seat the eyes+teeth cluster into the DEFORMED body by translating GEOMETRY.

    HumGen's eyeball/teeth meshes are authored to HumGen's rest face; after the body
    is re-skinned to the RPM armature its sockets/mouth shift a few cm, so the parts
    float out of the face. We compute the shift that moves the EYE mesh centroid onto
    the nearest deformed body surface (the socket) and apply that SAME shift to the
    teeth so the mouth keeps its fixed offset below the eyes. Matches Z (height) + Y
    (depth), preserves X (eye spacing); capped so a bad estimate can't fling the
    cluster. Geometry-level so the later rigid Head bind can't undo it.
    """
    _require_bpy()
    import statistics
    from mathutils import Vector

    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()

    eye = next((p for p in parts if 'eye' in p.name.lower()), None)
    if eye is None:
        return
    eco = [eye.matrix_world @ v.co for v in eye.data.vertices]
    ec = Vector((statistics.mean(p.x for p in eco),
                 statistics.mean(p.y for p in eco),
                 statistics.mean(p.z for p in eco)))

    body_eval = body.evaluated_get(dg)
    bmesh = body_eval.to_mesh()
    try:
        near = [body.matrix_world @ v.co for v in bmesh.vertices
                if (body.matrix_world @ v.co - ec).length < 0.06]
        if len(near) < 20:
            return
        bc = Vector((statistics.mean(p.x for p in near),
                     statistics.mean(p.y for p in near),
                     statistics.mean(p.z for p in near)))
    finally:
        body_eval.to_mesh_clear()

    world_shift = Vector((0.0,
                          max(min(bc.y - ec.y, 0.06), -0.06),
                          max(min(bc.z - ec.z, 0.08), -0.08)))
    if world_shift.length < 1e-3:
        return

    for p in parts:
        # Teeth sit deeper in the head than the eyes, so the eye-anchored shift leaves
        # them a touch low; give them a small extra upward nudge to seat in the mouth.
        extra = Vector((0.0, 0.0, 0.04)) if 'teeth' in p.name.lower() else Vector((0.0, 0.0, 0.0))
        mwi = p.matrix_world.inverted()
        local_shift = mwi.to_3x3() @ (world_shift + extra)
        me = p.data
        for v in me.vertices:
            v.co = v.co + local_shift
        if me.shape_keys:
            for kb in me.shape_keys.key_blocks:
                for pt in kb.data:
                    pt.co = pt.co + local_shift
    bpy.context.view_layer.update()


def reskin_to_rpm(gender, human=None, clothing_meshes=None):
    """Full Strategy-D flow. Returns (rpm_armature, body_mesh).

    Assumes a HumGen human already exists in the scene (created by humgen.py) and
    its face morphs are already bound (facemorphs.bind_all) so the HG rig can be
    dropped safely afterward.

    ``clothing_meshes`` (outfit + footwear meshes from humgen.apply_clothing) are
    scaled with the body, then Data-Transfer re-skinned onto the RPM armature so
    they deform with the shared RPM animation clips just like the body.
    """
    _require_bpy()
    rpm_arm, ref_mesh = import_rpm_reference()

    hg_rig = find_humgen_armature(exclude=rpm_arm)
    if hg_rig is None:
        raise RuntimeError('no HumGen armature in scene — generate the human first')
    body = find_body_mesh(hg_rig)

    # only clothing meshes that really exist + are skinned to the HG rig
    cloth = [m for m in (clothing_meshes or [])
             if m is not None and getattr(m, 'type', None) == 'MESH'
             and m.name in bpy.data.objects]

    # EVERY mesh riding the HG rig (eyes, teeth, clothing) must be scaled + shifted
    # by the SAME transform as the body, or they detach from the face/body when the
    # body is scaled to RPM height (e.g. eyeballs + teeth would float at the collar).
    hg_meshes = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o is not body
                 and (o.find_armature() is hg_rig or o.parent is hg_rig)]

    # Scale body + all HG-rig meshes together to the RPM silhouette FIRST, while the
    # body still has its full crown-to-floor extent — deleting geometry first would
    # corrupt the height measurement (mask_foot removes the feet, mask_torso the
    # torso) and mis-scale the avatar.
    _align_body_to_rpm(body, rpm_arm, ref_mesh, extras=hg_meshes)

    # NOW delete the clothing-COVERED body verts (body was baked FULL, so the kept
    # skin is textured) so the body can't poke through the garments, keeping a
    # neck/shoulder band under the collar so no gap opens.
    if cloth:
        delete_clothing_masked_geometry(body, clothing_meshes=cloth)

    transfer_weights(body, rpm_arm, ref_mesh)
    if cloth:
        reskin_clothing(cloth, rpm_arm, ref_mesh)
    # eyes/teeth (+ any stray HG-parented mesh that isn't clothing)
    merge_extra_meshes(body, rpm_arm, hg_rig, ref_mesh=ref_mesh, exclude=cloth)

    # discard the RPM reference body — we only needed its weights
    if ref_mesh is not None:
        bpy.data.objects.remove(ref_mesh, do_unlink=True)
    drop_humgen_rig(hg_rig)

    print(f'[skeleton] re-skinned {body.name} + {len(cloth)} clothing meshes '
          f'onto RPM_Armature ({gender})')
    return rpm_arm, body
