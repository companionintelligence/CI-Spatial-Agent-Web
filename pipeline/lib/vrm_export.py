"""VRM export step — configure the VRM humanoid + expressions and export ``.vrm``.

Targets **VRM 1.0** (per ASSET-PIPELINE.md §6.5). Uses the
``saturday06/VRM-Addon-for-Blender`` addon (module ``io_scene_vrm``). Two things
must be configured before export:

  1. Humanoid bone assignment — map the RPM armature bones to VRM humanoid slots
     (``RPM_TO_VRM_HUMANBONES``).
  2. Expressions — bind the 5 mouth visemes + emotion presets to the renamed
     morph targets (``VRM_VISEME_PRESETS`` / ``VRM_EXPRESSION_BINDS``).

The addon's data paths differ between VRM0 and VRM1 and across addon versions,
so every version-sensitive call is flagged. The app applies ``VRMUtils.rotateVRM0``
only for VRM0 — targeting VRM1 avoids that hack (forward = -Z on the VRM path).
"""

import os

try:
    import bpy
except ImportError:
    bpy = None

from mappings import (  # noqa: E402
    RPM_TO_VRM_HUMANBONES,
    VRM_VISEME_PRESETS,
    VRM_EXPRESSION_BINDS,
)


def _require_vrm():
    if bpy is None:
        raise RuntimeError('vrm_export.py must run inside Blender (bpy unavailable)')
    if 'io_scene_vrm' not in bpy.context.preferences.addons:
        raise RuntimeError(
            'VRM addon (io_scene_vrm) not enabled. Run pipeline/install_addons.py '
            'first (saturday06/VRM-Addon-for-Blender).'
        )


def assign_humanoid(armature):
    """Assign RPM bones to VRM 1.0 humanoid slots on the armature.

    TODO: verify against installed addon. The VRM addon stores humanoid mapping
    at ``armature.data.vrm_addon_extension.vrm1.humanoid.human_bones``, with each
    slot exposing a ``.node.bone_name`` string. Structure differs on VRM0
    (``.vrm0.humanoid.human_bones`` is a *list* of {bone, node} rather than a
    named struct). We target VRM1.
    """
    _require_vrm()
    ext = getattr(armature.data, 'vrm_addon_extension', None)
    if ext is None:
        raise RuntimeError('vrm_addon_extension missing on armature — is the VRM addon enabled?')

    human_bones = ext.vrm1.humanoid.human_bones  # TODO: verify path (vrm1)
    assigned = 0
    for rpm_name, vrm_slot in RPM_TO_VRM_HUMANBONES.items():
        if vrm_slot is None:
            continue
        slot = getattr(human_bones, vrm_slot, None)  # TODO: verify slot attr names
        if slot is None:
            print(f'[vrm_export] no VRM slot {vrm_slot!r} — skipping {rpm_name}')
            continue
        if rpm_name in {b.name for b in armature.data.bones}:
            slot.node.bone_name = rpm_name  # TODO: verify .node.bone_name path
            assigned += 1
    print(f'[vrm_export] assigned {assigned} humanoid bones')
    return assigned


def configure_expressions(armature, body_mesh):
    """Author VRM1 expression presets bound to the renamed morph targets.

    TODO: verify against installed addon. VRM1 expressions live at
    ``ext.vrm1.expressions.preset`` (the 5 mouths: aa/ee/ih/oh/ou; emotions:
    happy/angry/sad/relaxed/surprised; blink) and ``.custom`` for extras. Each
    preset exposes ``morph_target_binds`` — a collection of {node(mesh), index or
    name, weight}. The exact add/index API is version-specific.
    """
    _require_vrm()
    ext = armature.data.vrm_addon_extension  # TODO: verify path
    expressions = ext.vrm1.expressions       # TODO: verify path

    def _bind(preset_obj, morph_weights):
        for morph_name, weight in morph_weights.items():
            try:
                bind = preset_obj.morph_target_binds.add()   # TODO: verify API
                bind.node.mesh_object_name = body_mesh.name  # TODO: verify
                bind.index = morph_name                      # TODO: verify (name vs int index)
                bind.weight = float(weight)
            except Exception as e:  # noqa: BLE001
                print(f'[vrm_export] bind {morph_name} failed: {e}')

    # 5 mouth visemes — bind each to the max of its collapsed Oculus morphs.
    for preset_name, viseme_morphs in VRM_VISEME_PRESETS.items():
        preset_obj = getattr(expressions.preset, preset_name, None)  # TODO: verify
        if preset_obj is None:
            print(f'[vrm_export] no mouth preset {preset_name!r}')
            continue
        _bind(preset_obj, {m: 1.0 for m in viseme_morphs})

    # emotion / blink presets
    for preset_name, morph_weights in VRM_EXPRESSION_BINDS.items():
        preset_obj = getattr(expressions.preset, preset_name, None)  # TODO: verify
        if preset_obj is None:
            continue
        _bind(preset_obj, morph_weights)

    print('[vrm_export] configured VRM1 expressions')


def export_vrm(out_path, armature, body_mesh):
    """Configure humanoid + expressions, then export ``out_path`` (.vrm, VRM1)."""
    _require_vrm()
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)

    assign_humanoid(armature)
    configure_expressions(armature, body_mesh)

    bpy.ops.object.select_all(action='DESELECT')
    armature.select_set(True)
    for child in armature.children:
        child.select_set(True)
    bpy.context.view_layer.objects.active = armature

    # TODO: verify operator id + args on installed addon. Recent versions expose
    #   bpy.ops.export_scene.vrm(filepath=..., armature_object_name=...)
    # older ones used bpy.ops.export_scene.vrm(filepath=...) on the active armature.
    try:
        bpy.ops.export_scene.vrm(
            filepath=out_path,
            armature_object_name=armature.name,   # TODO: verify kwarg exists
        )
    except TypeError:
        bpy.ops.export_scene.vrm(filepath=out_path)  # fallback signature
    print(f'[vrm_export] wrote {out_path}')
    return out_path
