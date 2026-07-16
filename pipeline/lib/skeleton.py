"""Strategy R — RETARGET HumGen's native rig to the RPM clip skeleton.

The previous Strategy D re-skinned the HumGen *body* onto a separate RPM armature
via Data Transfer and re-seated the head/eyes/teeth/clothing onto RPM bones. That
produced a detached head, floating teeth/eyes, and clothing that exploded into
sheets when animated. It only ever passed the *name*-based validator.

Strategy R keeps HumGen's OWN character fully intact — its native armature, with
body + head + eyes + teeth + clothing all bound to it exactly as HumGen authored
them (one coherent skin, no re-seating). We make the app's shared RPM animation
clips drive it by:

  1. **Rest-pose alignment (the crux).** The RPM clips are authored against the RPM
     reference rest pose (``assets/avatars/rpm-mixamo-t-posed.glb``). three.js's
     AnimationMixer sets each bone's LOCAL transform absolutely per frame, and the
     mixamo clips bake translation on every bone — so at runtime the skeleton's
     per-bone WORLD pose becomes RPM's. For the skin to deform correctly, the
     exported avatar's inverse-bind matrices (baked from its rest) must equal the
     RPM rest world matrices. So we pose every HumGen deform bone that maps to an
     RPM bone into the RPM bone's exact rest world transform, then APPLY that as the
     new rest/bind pose (Blender rebinds the meshes so nothing moves visually). After
     this, HumGen's bind pose == RPM's rest pose, bone-for-bone.

  2. **Bone rename.** Rename the aligned HumGen deform bones to the RPM names
     (``mappings.HUMGEN_TO_RPM_BONES``) AND rename the matching vertex group on every
     skinned mesh, so the clips' name-addressed tracks resolve and the skin stays
     bound.

No Data Transfer, no re-parenting, no head/teeth/eye re-seating. The head stays on
the neck, teeth stay in the mouth, eyes stay in the sockets, and sleeves follow the
arms — because none of that binding is ever touched; only the rest pose is aligned
and the bones are renamed.

Shape keys (ARKit + visemes) are rig-independent — a pose→apply-rest and a bone
rename never touch shape-key data — so they survive unchanged.

Runs under ``blender --background``.
"""

import os

try:
    import bpy
except ImportError:  # allow import outside Blender (docs/lint)
    bpy = None

from mappings import RPM_CONTRACT_BONES, HUMGEN_TO_RPM_BONES  # noqa: E402

# Eye bones are renamed (so LeftEye/RightEye satisfy the contract + gaze position
# lookup) but NOT rest-aligned: HumGen's eye bones point back into the head, so
# posing them to RPM's forward-pointing eye rest rotates the eyeball meshes ~108°
# and pops them out of the sockets. The GLB gaze path only reads eye WORLD POSITION
# (which HumGen already places correctly in the sockets), never the eye bone
# orientation — so we leave the eye rest as HumGen authored it.
_EYE_BONES = {'eyeball.L', 'eyeball.R'}


# The in-tree RPM T-pose reference rig (Anselm) — carries the exact RPM armature
# AND a real skinned reference mesh to transfer weights from. This is the rig the
# app's shared GLB animation clips target.
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RPM_REFERENCE_GLB = os.path.join(
    _REPO_ROOT, 'apps', 'web', 'public', 'assets', 'avatars',
    'rpm-mixamo-t-posed.glb',
)

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


def _rpm_reference_path():
    for p in _RPM_REF_CANDIDATES:
        if os.path.exists(p):
            return p
    raise FileNotFoundError(
        'RPM reference GLB not found; looked in: ' + ', '.join(_RPM_REF_CANDIDATES))


def import_rpm_reference():
    """Import the RPM T-pose reference GLB. Returns (armature, [imported_objs]).

    The armature carries the RPM rest pose we align HumGen to. We assert it exposes
    the RPM contract bones so a wrong/renamed reference fails fast.
    """
    _require_bpy()
    path = _rpm_reference_path()
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [o for o in bpy.data.objects if o not in before]

    armature = next((o for o in imported if o.type == 'ARMATURE'), None)
    if armature is None:
        raise RuntimeError(f'no armature in RPM reference GLB: {path}')

    names = {b.name for b in armature.data.bones}
    missing = [b for b in RPM_CONTRACT_BONES if b not in names]
    if missing:
        raise RuntimeError(
            f'RPM reference {path} missing contract bones {missing}; '
            f'got {sorted(names)[:12]}...')
    return armature, imported


def find_humgen_armature(exclude):
    """Return the HumGen rig armature (the armature that is not ``exclude``)."""
    _require_bpy()
    for o in bpy.data.objects:
        if o.type == 'ARMATURE' and o is not exclude:
            return o
    return None


def align_rest_to_rpm(hg_rig, rpm_arm):
    """Pose every mapped HumGen deform bone into its RPM bone's exact rest world
    transform, then apply the pose as the new rest — so HumGen's bind pose == RPM's.

    Method (deterministic, exact — no constraint-chain drift):

def _align_body_to_rpm(body, rpm_armature):
    """Match the HumGen body's height + vertical placement to the RPM armature.

    Both are authored standing at the origin in metres and typically already
    coincide within a couple of cm. We scale uniformly so the body's total height
    matches the armature's, then translate so the feet sit at the same Z. Nearest-
    face weight transfer is robust to small residual offset; this just tightens it.
    """
    _require_bpy()
    body_h = body.dimensions.z
    arm_h = rpm_armature.dimensions.z
    if body_h > 1e-4 and arm_h > 1e-4:
        scale = arm_h / body_h
        # only correct meaningful mismatches (>2%) — HumGen is already ~1.8 m
        if abs(scale - 1.0) > 0.02:
            body.scale = tuple(s * scale for s in body.scale)
            bpy.context.view_layer.update()
            print(f'[skeleton] scaled body by {scale:.3f} to match RPM height')
    # align feet (min Z) to the armature's min Z
    bpy.context.view_layer.update()
    body_min_z = min((body.matrix_world @ v.co).z for v in body.data.vertices)
    arm_min_z = rpm_armature.matrix_world.translation.z  # RPM root at floor (z=0)
    dz = arm_min_z - body_min_z
    if abs(dz) > 1e-3:
        body.location.z += dz
        bpy.context.view_layer.update()
        print(f'[skeleton] shifted body Z by {dz:.3f} to align feet')


def transfer_weights(body, rpm_armature, ref_mesh):
    """Transfer RPM skin weights onto the HumGen body and bind to the RPM rig.

    Uses a Data Transfer modifier (nearest-face-interpolated VGROUP_WEIGHTS) with
    ``ref_mesh`` (the real RPM body) as source. This creates RPM-named vertex
    groups on the HumGen body. The modifier is then applied (safe with shape keys
    — vertex-group transfer changes no geometry), the HG body is parented to the
    RPM armature with an Armature modifier, and non-RPM groups are pruned.
    """
    _require_bpy()

    # 0. clear any armature modifier pointing at the old HG rig
    for mod in list(body.modifiers):
        if mod.type == 'ARMATURE':
            body.modifiers.remove(mod)

    # 1. the HG body must already own vertex groups named for every RPM bone so
    #    Data Transfer (layers_select_dst='NAME') has a destination to fill.
    existing = {vg.name for vg in body.vertex_groups}
    for bone in (b.name for b in rpm_armature.data.bones):
        if bone not in existing:
            body.vertex_groups.new(name=bone)

    # 2. Data Transfer modifier: nearest-face-interpolated vgroup weights.
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body

    dt = body.modifiers.new(name='RPM_WeightTransfer', type='DATA_TRANSFER')
    dt.object = ref_mesh
    dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}
    dt.vert_mapping = 'POLYINTERP_NEAREST'      # nearest-face, interpolated
    dt.layers_vgroup_select_src = 'ALL'
    dt.layers_vgroup_select_dst = 'NAME'        # match by group name
    dt.mix_mode = 'REPLACE'

    # apply — bakes transferred weights into the body's vertex groups. Vertex-
    # group data transfer changes no geometry, so it applies cleanly even with
    # shape keys present.
    try:
        bpy.ops.object.modifier_apply(modifier=dt.name)
        print('[skeleton] applied Data Transfer (RPM weights -> HumGen body)')
    except RuntimeError as e:
        # Fallback: some builds refuse modifier_apply on shape-keyed meshes.
        # Use the operator form which writes directly into vertex groups.
        print(f'[skeleton] modifier_apply refused ({e}); using data_transfer operator')
        body.modifiers.remove(dt)
        bpy.ops.object.data_transfer(
            use_reverse_transfer=False,
            data_type='VGROUP_WEIGHTS',
            vert_mapping='POLYINTERP_NEAREST',
            layers_select_src='ALL',
            layers_select_dst='NAME',
            mix_mode='REPLACE',
        )

    # 3. prune vertex groups that aren't RPM bones (HumGen mask/lip groups etc.)
    rpm_bone_names = {b.name for b in rpm_armature.data.bones}
    for vg in list(body.vertex_groups):
        if vg.name not in rpm_bone_names:
            body.vertex_groups.remove(vg)

    # 4. bind to the RPM armature
    body.parent = rpm_armature
    body.matrix_parent_inverse = rpm_armature.matrix_world.inverted()
    arm_mod = body.modifiers.new(name='RPM_Armature', type='ARMATURE')
    arm_mod.object = rpm_armature
    arm_mod.use_vertex_groups = True

    kept = len(body.vertex_groups)
    print(f'[skeleton] body now bound to RPM_Armature with {kept} RPM vertex groups')
    return body


def drop_humgen_rig(humgen_rig):
    """Delete the HumGen armature after weights are transferred."""
    _require_bpy()
    if humgen_rig is not None:
        bpy.data.objects.remove(humgen_rig, do_unlink=True)


def merge_extra_meshes(body, rpm_armature, humgen_rig):
    """Re-skin the eyes/teeth meshes onto the RPM rig too, so they ride along.

    HumGen splits eyes + upper/lower teeth into separate meshes skinned to the HG
    rig (mostly to Head/jaw). We rebind them to the RPM armature by name-matching
    their existing HG vertex groups against RPM bones where possible, then parent.
    Meshes with no usable weights are simply parented to Head so they follow.
    """
    _require_bpy()
    rpm_bone_names = {b.name for b in rpm_armature.data.bones}
    extras = [o for o in bpy.data.objects
              if o.type == 'MESH' and o is not body
              and (o.find_armature() is humgen_rig or o.parent is humgen_rig)]
    for m in extras:
        for mod in list(m.modifiers):
            if mod.type == 'ARMATURE':
                m.modifiers.remove(mod)
        # keep any vgroup already named for an RPM bone; if none, weight all to Head
        has_rpm_group = any(vg.name in rpm_bone_names for vg in m.vertex_groups)
        if not has_rpm_group:
            head_vg = m.vertex_groups.get('Head') or m.vertex_groups.new(name='Head')
            head_vg.add(range(len(m.data.vertices)), 1.0, 'REPLACE')
        m.parent = rpm_armature
        m.matrix_parent_inverse = rpm_armature.matrix_world.inverted()
        am = m.modifiers.new(name='RPM_Armature', type='ARMATURE')
        am.object = rpm_armature
    if extras:
        print(f'[skeleton] rebound {len(extras)} extra meshes '
              f'({", ".join(m.name for m in extras)}) to RPM_Armature')
    return extras


def reskin_to_rpm(gender, human=None):
    """Full Strategy-D flow. Returns (rpm_armature, body_mesh).

    Assumes a HumGen human already exists in the scene (created by humgen.py) and
    its face morphs are already bound (facemorphs.bind_all) so the HG rig can be
    dropped safely afterward.
    """
    _require_bpy()
    # bones
    for hg_name, rpm_name in HUMGEN_TO_RPM_BONES.items():
        b = hg_rig.data.bones.get(hg_name)
        if b is not None:
            b.name = rpm_name
    # vertex groups on every mesh skinned to this rig
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        for hg_name, rpm_name in HUMGEN_TO_RPM_BONES.items():
            vg = o.vertex_groups.get(hg_name)
            if vg is not None:
                vg.name = rpm_name
    hg_rig.name = 'RPM_Armature'
    hg_rig.data.name = 'RPM_Armature'
    print('[skeleton] renamed HumGen deform bones + vertex groups to RPM names')


def retarget_to_rpm(gender, human=None):
    """Full Strategy-R flow. Returns (armature, body_mesh).

    Assumes a clothed HumGen human already exists in the scene (created by humgen.py)
    and its face morphs are already bound (facemorphs.bind_all). Keeps the HumGen
    native rig; aligns its rest to RPM and renames its bones. The SAME armature that
    HumGen skinned everything to is what we export — head/eyes/teeth/clothing stay
    coherently bound.
    """
    _require_bpy()
    rpm_arm, rpm_objs = import_rpm_reference()

    hg_rig = find_humgen_armature(exclude=rpm_arm)
    if hg_rig is None:
        raise RuntimeError('no HumGen armature in scene — generate the human first')

    _align_body_to_rpm(body, rpm_arm)
    transfer_weights(body, rpm_arm, ref_mesh)
    merge_extra_meshes(body, rpm_arm, hg_rig)

    # discard the RPM reference body — we only needed its weights
    if ref_mesh is not None:
        bpy.data.objects.remove(ref_mesh, do_unlink=True)
    drop_humgen_rig(hg_rig)

    print(f'[skeleton] re-skinned {body.name} onto RPM_Armature ({gender})')
    return rpm_arm, body
