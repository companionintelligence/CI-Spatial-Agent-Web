"""Generate a HumGen avatar as a NATIVE VRM 1.0 export (no RPM re-skin).

This is the VRM-first path from docs/FACIAL-ANIMATION-PLAN.md §"VRM-first HumGen".
Unlike generate_avatar.py (which forces the HumGen body onto the RPM skeleton and
breaks the head), this keeps the HumGen character exactly as HumGen authors it —
head, eyes, teeth, hair and clothing all bound to HumGen's own Rigify rig — and
exports it as ``.vrm`` by mapping that rig onto the VRM humanoid. @pixiv/three-vrm
then retargets the shared VRMA clips via the humanoid bone map, so the head stays
coherent (teeth inside the mouth, eyes in the sockets).

Flow:
  1. generate a clothed HumGen human on its native rig (humgen.py: preset +
     randomize + outfit + footwear + short hair -> haircards)
  2. bind ARKit-52 + 15 Oculus visemes as shape keys (facemorphs.py:
     load_facial_rig -> prepare_for_arkit -> derive visemes)
  3. flatten the procedural skin/eye materials to direct-map Principled BSDFs so
     the base color exports cleanly (vrm_export.simplify_humgen_materials)
  4. export VRM 1.0 (vrm_export.export_vrm):
       - bone-parent eyes+teeth to the head bone (fixes 'floating teeth/eyes')
       - bind haircards to head + MToon alpha-mask (fixes hair shard-soup)
       - assign HumGen Rigify deform bones -> VRM humanoid slots
       - author the 5 VRM visemes + emotion presets + ARKit-52 custom expressions
       - downscale + embed textures, then write .vrm

Invocation (headless)::

    "/Applications/Blender 4.5.app/Contents/MacOS/Blender" \
        --background --python pipeline/generate_vrm.py -- \
        --gender female --name humgen-aria-01 --seed 6 \
        --content-path "~/HumGen_content" \
        --out assets/avatars/humgen-aria-01.vrm

NB: do NOT set a target height — HumGen's height change deforms the body via
shape keys after the eyes/teeth are authored, which desyncs the VRM head-part
bone-parent (VERIFIED: it re-floats the eyes/teeth). The preset default (~1.7 m)
is used.
"""

import argparse
import os
import sys
import traceback

_PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
_LIB_DIR = os.path.join(_PIPELINE_DIR, 'lib')
for _p in (_LIB_DIR, _PIPELINE_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    import bpy
except ImportError:
    print('ERROR: generate_vrm.py must run inside Blender. See the header for the '
          'exact invocation.', file=sys.stderr)
    sys.exit(2)


def _argv_after_ddash():
    argv = sys.argv
    return argv[argv.index('--') + 1:] if '--' in argv else []


def parse_args():
    p = argparse.ArgumentParser(description='Generate a native VRM 1.0 HumGen avatar.')
    p.add_argument('--seed', type=int, default=0, help='deterministic preset/randomize seed')
    p.add_argument('--gender', choices=['male', 'female'], default='female')
    p.add_argument('--name', default='Aria', help='VRM meta name / output basename')
    p.add_argument('--out', required=True, help='output .vrm path')
    p.add_argument('--content-path', default='~/HumGen_content',
                   help='HumGen content library path (has the .hgpack packs)')
    p.add_argument('--outfit', default=None, help='specific HumGen outfit preset (else random)')
    p.add_argument('--footwear', default=None, help='specific footwear preset (else random)')
    p.add_argument('--hair', default=None, help='specific hair preset (else short default)')
    p.add_argument('--max-texture', type=int, default=1024,
                   help='cap embedded texture size (px); 1024 keeps the file small')
    p.add_argument('--skip-addon-enable', action='store_true')
    return p.parse_args(_argv_after_ddash())


def _enable_addons(content_path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.preferences.addon_enable(module='HumGen3D')
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(f'could not enable HumGen3D: {e}. Run install_addons.py first.') from e
    try:
        bpy.ops.preferences.addon_enable(module='io_scene_vrm')
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(
            f'could not enable io_scene_vrm: {e}. Install VRM-Addon-for-Blender '
            f'(io_scene_vrm) — see pipeline/README.md §3.'
        ) from e
    cp = os.path.expanduser(content_path)
    if not cp.endswith(os.sep):
        cp += os.sep
    prefs = bpy.context.preferences.addons.get('HumGen3D')
    if prefs is not None:
        p = prefs.preferences
        for attr in ('filepath', 'filepath_', 'content_path', 'content_filepath'):
            if hasattr(p, attr):
                setattr(p, attr, cp)
                break


def build_vrm(args):
    import humgen
    import facemorphs
    import vrm_export

    if not args.skip_addon_enable:
        _enable_addons(args.content_path)

    # 1. clothed HumGen human on its native rig
    human = humgen.generate_human(seed=args.seed, gender=args.gender, height=None)
    humgen.add_clothing(human, gender=args.gender, outfit=args.outfit, footwear=args.footwear)
    humgen.add_hair_haircards(human, gender=args.gender, style=args.hair)

    body = humgen.get_body_object(human)

    # 2. ARKit + visemes on the body (native rig still present)
    facemorphs.bind_all(body, human=human)

    # 3. flatten procedural skin/eye materials -> clean base color
    vrm_export.simplify_humgen_materials(human)

    # 4. export native VRM 1.0 (humanoid + expressions + head-part fix + textures)
    rig = human.objects.rig
    out = os.path.abspath(os.path.expanduser(args.out))
    vrm_export.export_vrm(out, rig, body, name=args.name, max_texture=args.max_texture)
    return out


def main():
    args = parse_args()
    try:
        out = build_vrm(args)
    except Exception:  # noqa: BLE001
        traceback.print_exc()
        print('\n[generate_vrm] FAILED — see traceback above.', file=sys.stderr)
        sys.exit(1)
    size_mb = os.path.getsize(out) / (1024 * 1024)
    print(f'\n[generate_vrm] done. Wrote {out} ({size_mb:.1f} MB)')
    print('Next: load in the app (drop under apps/web/public/assets/avatars/vrm/) '
          'and drive via the isVRM path in AvatarModel.tsx.')


if __name__ == '__main__':
    main()
