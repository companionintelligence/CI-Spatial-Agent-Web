"""GLB export step — write a web/XR-ready ``.glb`` satisfying the rig contract.

Uses Blender's bundled glTF2 exporter (the patched exporter in DRIVE-ASSETS.md
is only needed for edge cases; the stock one exports morph targets + skin fine
on 4.5). Morph target names MUST survive export — the exporter writes them to
``mesh.extras.targetNames``, which is what the app's GLTFLoader reads.
"""

import os

try:
    import bpy
except ImportError:
    bpy = None


def _require_bpy():
    if bpy is None:
        raise RuntimeError('glb_export.py must run inside Blender (bpy unavailable)')


def export_glb(out_path, armature=None):
    """Export the current scene selection to ``out_path`` (.glb, +Z forward).

    The GLB path in the app uses forward = +Z, so we export in Blender's default
    orientation (the RPM T-pose was authored that way). We DO NOT bake in body
    animations — those stay the shared RPM clip library.
    """
    _require_bpy()
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)

    # Select the armature + its skinned meshes so the export scopes to the avatar.
    bpy.ops.object.select_all(action='DESELECT')
    if armature is not None:
        armature.select_set(True)
        for child in armature.children:
            child.select_set(True)
        bpy.context.view_layer.objects.active = armature

    # TODO: verify export flags on installed 4.5 glTF2 exporter. Key options:
    #   export_morph=True                 -> keep shape keys as morph targets
    #   export_morph_normal=True          -> smoother morph deformation
    #   export_skins=True                 -> keep the RPM armature skin
    #   export_yup=True                   -> glTF +Y up convention
    #   use_selection=True                -> only the selected avatar
    #   export_apply=False                -> KEEP modifiers unapplied? No — apply
    #                                        so the Armature modifier bakes; but
    #                                        apply=True destroys shape keys, so we
    #                                        rely on export_morph instead and keep
    #                                        modifiers live.
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        use_selection=(armature is not None),
        export_yup=True,
        export_morph=True,
        export_morph_normal=True,
        export_skins=True,
        export_animations=False,          # body anims live in the shared clip lib
        export_apply=False,               # preserve shape keys (morph targets)
    )
    print(f'[glb_export] wrote {out_path}')
    return out_path
