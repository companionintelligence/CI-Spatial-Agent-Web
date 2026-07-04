"""Strategy D — re-skin the HumGen body onto the RPM skeleton.

The HumGen human ships a Rigify-derived rig. The app expects the RPM/Mixamo
skeleton (bone names ``Hips/Spine/Spine1/Spine2/Neck/Head/LeftEye/RightEye/...``)
so that the 238 RPM clips + the app's GLB clips play natively and the GLB
head-finder / gaze service find their bones by name.

This module imports the RPM T-pose armature (already the exact rig), transfers
the HumGen body vertex weights onto it, reparents the mesh, and deletes the
HumGen rig. Output matches ``rpm-mixamo-t-posed.glb`` bone-for-bone.

Runs under ``blender --background``. All API calls that are version-sensitive
are flagged ``# TODO: verify against installed addon``.
"""

import os

try:
    import bpy
except ImportError:  # allow import outside Blender (docs/lint)
    bpy = None

from mappings import RPM_BONES, RPM_CONTRACT_BONES  # noqa: E402


# RPM T-pose GLBs shipped with the animation library (already the exact rig).
RPM_LIBRARY = '/Users/liam/devel/3d/animation-library-master'
RPM_TPOSE = {
    'male':   os.path.join(RPM_LIBRARY, 'masculine', 'glb', 'Masculine_TPose.glb'),
    'female': os.path.join(RPM_LIBRARY, 'feminine',  'glb', 'Feminine_TPose.glb'),
}


def _require_bpy():
    if bpy is None:
        raise RuntimeError('skeleton.py must run inside Blender (bpy unavailable)')


def import_rpm_tpose(gender):
    """Import the RPM T-pose armature for ``gender`` and return the armature obj.

    The GLB contains {armature, body mesh, ...}; we keep only the armature.
    """
    _require_bpy()
    path = RPM_TPOSE.get(gender)
    if not path or not os.path.exists(path):
        raise FileNotFoundError(
            f'RPM T-pose GLB not found for gender={gender!r}: {path}\n'
            f'Expected under {RPM_LIBRARY} (see docs/DRIVE-ASSETS.md).'
        )

    before = set(bpy.data.objects)
    # glTF importer is bundled with Blender; options are stable on 4.5.
    bpy.ops.import_scene.gltf(filepath=path)  # TODO: verify import flags on 4.5
    imported = [o for o in bpy.data.objects if o not in before]

    armature = next((o for o in imported if o.type == 'ARMATURE'), None)
    if armature is None:
        raise RuntimeError(f'no armature found in RPM T-pose GLB: {path}')

    # Drop the RPM sample body mesh — we only want its skeleton.
    for o in imported:
        if o is not armature and o.type == 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)

    _assert_rpm_bones(armature)
    armature.name = 'RPM_Armature'
    return armature


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
    """Return the HumGen body mesh (largest mesh parented to the HG rig)."""
    _require_bpy()
    candidates = [o for o in bpy.data.objects
                  if o.type == 'MESH' and o.find_armature() is humgen_rig]
    if not candidates:
        # fall back: any mesh whose parent is the HG rig
        candidates = [o for o in bpy.data.objects
                      if o.type == 'MESH' and o.parent is humgen_rig]
    if not candidates:
        raise RuntimeError('could not locate HumGen body mesh')
    # body = mesh with the most vertices (clothes/hair are separate, smaller)
    return max(candidates, key=lambda m: len(m.data.vertices))


def transfer_weights(source_mesh, rpm_armature, humgen_rig):
    """Transfer HumGen body weights onto the RPM armature and reparent.

    Strategy: rename/remap vertex groups from HG bone names to RPM bone names
    where a mapping exists, then bind the mesh to the RPM armature via an
    Armature modifier. Where HG and RPM bone topology differ (fingers, face),
    use Blender's Data Transfer of vertex weights from the (posed-identical)
    RPM sample as a fallback.

    NOTE: this is the highest-risk step. HumGen's rig is Rigify-derived and its
    deform bone names are NOT RPM names, so a plain vgroup rename is insufficient
    for the whole body — clean face/hand weights need Data Transfer or manual
    reweight. The mesh + reparent plumbing here is correct; the HG->RPM deform
    bone name table is the piece that must be built against the installed addon.
    """
    _require_bpy()

    # --- 1. clear existing armature modifiers pointing at the HG rig ---
    for mod in list(source_mesh.modifiers):
        if mod.type == 'ARMATURE' and mod.object is humgen_rig:
            source_mesh.modifiers.remove(mod)

    # --- 2. remap vertex groups HG deform bone name -> RPM bone name ---
    # TODO: verify against installed addon — HumGen v4 deform bones are named
    # by its Rigify metarig (e.g. 'DEF-spine', 'DEF-upper_arm.L'); build a
    # HG_DEFORM_TO_RPM table by dumping [b.name for b in hg_rig.data.bones].
    # Until that table exists, we keep matching-named groups and rely on the
    # Data Transfer fallback (step 4) for the rest.
    rpm_bone_set = set(RPM_BONES)
    _remap_matching_vertex_groups(source_mesh, rpm_bone_set)

    # --- 3. bind to RPM armature ---
    source_mesh.parent = rpm_armature
    arm_mod = source_mesh.modifiers.new(name='RPM_Armature', type='ARMATURE')
    arm_mod.object = rpm_armature
    arm_mod.use_vertex_groups = True

    # --- 4. fallback: Data Transfer weights from RPM sample where groups are
    # missing. Left as an explicit hook; the RPM sample body was discarded in
    # import_rpm_tpose(), so re-import it transiently if this fallback is needed.
    # TODO: implement Data Transfer fallback once HG_DEFORM_TO_RPM is verified.

    return source_mesh


def _remap_matching_vertex_groups(mesh, rpm_bone_set):
    """Best-effort: keep vertex groups whose names already match RPM bones."""
    kept = 0
    for vg in mesh.vertex_groups:
        if vg.name in rpm_bone_set:
            kept += 1
    # Nothing destructive here — HG groups that don't match RPM simply won't
    # deform any RPM bone. Reported so the operator sees coverage.
    print(f'[skeleton] vertex groups matching RPM bones: {kept}/{len(mesh.vertex_groups)}')
    return kept


def drop_humgen_rig(humgen_rig):
    """Delete the HumGen armature after weights are transferred."""
    _require_bpy()
    if humgen_rig is not None:
        bpy.data.objects.remove(humgen_rig, do_unlink=True)


def reskin_to_rpm(gender):
    """Full Strategy-D flow. Returns (rpm_armature, body_mesh).

    Assumes a HumGen human already exists in the scene (created by humgen.py).
    """
    _require_bpy()
    rpm_arm = import_rpm_tpose(gender)
    hg_rig = find_humgen_armature(exclude=rpm_arm)
    if hg_rig is None:
        raise RuntimeError('no HumGen armature in scene — generate the human first')
    body = find_body_mesh(hg_rig)
    transfer_weights(body, rpm_arm, hg_rig)
    drop_humgen_rig(hg_rig)
    print(f'[skeleton] re-skinned {body.name} onto RPM_Armature ({gender})')
    return rpm_arm, body
