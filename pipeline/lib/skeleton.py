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


# The in-tree RPM T-pose reference rig. It carries the exact RPM armature whose
# rest pose the shared GLB animation clips are authored against — the pose we align
# HumGen's rest to. (Its Wolf3D_Avatar mesh + placeholder Icosphere are discarded;
# Strategy R needs only the armature's rest transforms.)
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
_RPM_REF_CANDIDATES = [
    os.path.join(_REPO_ROOT, 'assets', 'avatars', 'rpm-mixamo-t-posed.glb'),
    os.path.join(_REPO_ROOT, 'apps', 'web', 'public', 'assets', 'avatars',
                 'rpm-mixamo-t-posed.glb'),
]


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

      * Disconnect the mapped bones (``use_connect=False``) so each bone's head is
        independent of its parent's tip; otherwise a connected child's head is locked
        to the parent tail and can't land on the RPM head when segment lengths differ.
      * Walk the pose bones PARENT-FIRST and set each mapped bone's armature-space
        pose ``matrix`` to the RPM bone's rest world matrix (converted into the HG
        armature's space). Assigning ``pose_bone.matrix`` parent-first makes each
        bone's rest world exactly equal RPM's (verified: dHead == 0, dRot == 0 for
        every body bone).
      * ``pose.armature_apply`` bakes the pose into the rest and rebinds the skinned
        meshes so they don't move.

    Only orientation + head position matter for the bind (bone length does not enter
    the bind matrix), so eye bones whose axis differs from RPM (HumGen eyes point
    into the head) are harmless — their world POSITION still matches, which is all
    the GLB gaze path reads.
    """
    _require_bpy()

    # RPM rest world matrices, keyed by RPM bone name.
    rpm_rest = {b.name: rpm_arm.matrix_world @ b.matrix_local
                for b in rpm_arm.data.bones}

    bpy.ops.object.select_all(action='DESELECT')
    hg_rig.select_set(True)
    bpy.context.view_layer.objects.active = hg_rig

    # 1. disconnect mapped bones so their heads move independently
    bpy.ops.object.mode_set(mode='EDIT')
    for eb in hg_rig.data.edit_bones:
        if eb.name in HUMGEN_TO_RPM_BONES:
            eb.use_connect = False
    bpy.ops.object.mode_set(mode='POSE')

    # 2. parent-first order
    order, seen = [], set()

    def _add(pb):
        if pb.name in seen:
            return
        if pb.parent:
            _add(pb.parent)
        seen.add(pb.name)
        order.append(pb)

    for pb in hg_rig.pose.bones:
        _add(pb)

    hg_inv = hg_rig.matrix_world.inverted()
    posed = 0
    for pb in order:
        if pb.name in _EYE_BONES:
            continue  # rename only; keep HumGen eye rest so eyeballs stay in sockets
        tgt = HUMGEN_TO_RPM_BONES.get(pb.name)
        if tgt and tgt in rpm_rest:
            pb.matrix = hg_inv @ rpm_rest[tgt]
            bpy.context.view_layer.update()
            posed += 1

    # 3. bake pose as rest (Blender rebinds meshes -> geometry unchanged)
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    print(f'[skeleton] aligned {posed} HumGen bones to RPM rest, applied as bind pose')


def rename_bones_to_rpm(hg_rig):
    """Rename the aligned HumGen deform bones to RPM names AND rename the matching
    vertex group on every skinned mesh, so the shared clips' name-addressed tracks
    resolve and the skin stays bound.

    Renaming a bone does NOT rename a mesh's vertex group of the same name (vertex
    groups are independent name strings), so we rename both.
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

    align_rest_to_rpm(hg_rig, rpm_arm)

    # drop the RPM reference objects — we only needed its rest transforms
    for o in rpm_objs:
        try:
            bpy.data.objects.remove(o, do_unlink=True)
        except Exception:  # noqa: BLE001
            pass

    rename_bones_to_rpm(hg_rig)

    # resolve the body mesh (largest mesh skinned to the rig) for the caller
    body = _find_body_mesh(hg_rig)
    print(f'[skeleton] retargeted HumGen rig to RPM clip skeleton ({gender})')
    return hg_rig, body


def _find_body_mesh(rig):
    _require_bpy()
    meshes = [o for o in bpy.data.objects
              if o.type == 'MESH' and (o.find_armature() is rig or o.parent is rig)]
    if not meshes:
        raise RuntimeError('could not locate HumGen body mesh after retarget')
    # the HG_Body mesh has the most vertices and is not a clothing/shoe tag
    body_named = next((m for m in meshes if m.name.startswith('HG_Body')), None)
    if body_named is not None:
        return body_named
    return max(meshes, key=lambda m: len(m.data.vertices))
