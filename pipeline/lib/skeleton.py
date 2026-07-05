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
    rpm_arm, ref_mesh = import_rpm_reference()

    hg_rig = find_humgen_armature(exclude=rpm_arm)
    if hg_rig is None:
        raise RuntimeError('no HumGen armature in scene — generate the human first')
    body = find_body_mesh(hg_rig)

    _align_body_to_rpm(body, rpm_arm)
    transfer_weights(body, rpm_arm, ref_mesh)
    merge_extra_meshes(body, rpm_arm, hg_rig)

    # discard the RPM reference body — we only needed its weights
    if ref_mesh is not None:
        bpy.data.objects.remove(ref_mesh, do_unlink=True)
    drop_humgen_rig(hg_rig)

    print(f'[skeleton] re-skinned {body.name} onto RPM_Armature ({gender})')
    return rpm_arm, body
