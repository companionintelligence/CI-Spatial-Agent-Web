"""Main entry — generate one avatar (GLB and/or VRM) headlessly.

Orchestrates the full Strategy-D flow:

    HumGen human  ->  re-skin onto RPM skeleton  ->  rename/bind face morphs
                  ->  GLB export  (+  VRM export)

Invocation (per ASSET-PIPELINE.md §4)::

    "/Applications/Blender 4.5.app/Contents/MacOS/Blender" \
        --background --factory-startup \
        --python pipeline/generate_avatar.py -- \
        --seed 42 --gender male --name Aria --height 1.80 \
        --emit glb,vrm --out apps/web/public/assets/avatars

Because the recommended invocation uses ``--factory-startup`` (reproducible, CI),
saved user prefs are ignored, so this script enables the addons itself before
running. Use install_addons.py once to place the addon zips + content packs.
"""

import argparse
import os
import sys
import traceback

# --- make `pipeline/` importable regardless of Blender's cwd ---
_PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
if _PIPELINE_DIR not in sys.path:
    sys.path.insert(0, _PIPELINE_DIR)

try:
    import bpy
except ImportError:
    print('ERROR: generate_avatar.py must run inside Blender. See the header for '
          'the exact invocation.', file=sys.stderr)
    sys.exit(2)

from mappings import RPM_CONTRACT_BONES, OCULUS_VISEMES, ARKIT_CONTRACT_MORPHS  # noqa: E402


# ---------------------------------------------------------------------------
# arg parsing (everything after `--`)
# ---------------------------------------------------------------------------

def _argv_after_ddash():
    argv = sys.argv
    return argv[argv.index('--') + 1:] if '--' in argv else []


def parse_args():
    p = argparse.ArgumentParser(description='Generate a CI avatar (GLB/VRM).')
    p.add_argument('--seed', type=int, default=0, help='deterministic RNG seed')
    p.add_argument('--gender', choices=['male', 'female'], default='male')
    p.add_argument('--name', required=True, help='avatar name (output basename)')
    p.add_argument('--height', type=float, default=None, help='height in metres, e.g. 1.80')
    p.add_argument('--emit', default='glb', help='comma list: glb,vrm')
    p.add_argument('--out', required=True, help='output dir for .glb (vrm goes to <out>/vrm)')
    p.add_argument('--content-path', default=None,
                   help='HumGen content library path (needed under --factory-startup)')
    p.add_argument('--skip-addon-enable', action='store_true',
                   help='assume addons already enabled (interactive/BlenderMCP session)')
    return p.parse_args(_argv_after_ddash())


# ---------------------------------------------------------------------------
# scene setup
# ---------------------------------------------------------------------------

def _reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def _enable_addons(content_path):
    """Enable HumGen3D + VRM addon (needed because we run --factory-startup)."""
    for module in ('HumGen3D', 'io_scene_vrm'):
        try:
            bpy.ops.preferences.addon_enable(module=module)
        except Exception as e:  # noqa: BLE001
            raise RuntimeError(
                f'could not enable {module!r}: {e}. Run pipeline/install_addons.py '
                f'first (see pipeline/README.md).'
            ) from e
    if content_path:
        # best-effort content path set (see install_addons.py for the caveat)
        prefs = bpy.context.preferences.addons.get('HumGen3D')
        if prefs is not None:
            p = prefs.preferences
            for attr in ('filepath', 'filepath_', 'content_path', 'content_filepath'):
                if hasattr(p, attr):
                    setattr(p, attr, os.path.expanduser(content_path))
                    break


# ---------------------------------------------------------------------------
# orchestration
# ---------------------------------------------------------------------------

def build_avatar(args):
    import humgen
    import skeleton
    import facemorphs
    import glb_export
    import vrm_export

    _reset_scene()
    if not args.skip_addon_enable:
        _enable_addons(args.content_path)

    # 1. generate the HumGen human
    human = humgen.generate_human(seed=args.seed, gender=args.gender, height=args.height)

    # 2. Strategy D — re-skin body onto RPM skeleton, drop HG rig
    rpm_arm, body = skeleton.reskin_to_rpm(args.gender)

    # 3. rename/bind face morphs to the app's viseme_* + ARKit names
    morph_names = facemorphs.bind_all(body)

    # 4. sanity-check the rig contract in-Blender before we export
    _preflight_contract(rpm_arm, body)

    emit = {e.strip().lower() for e in args.emit.split(',') if e.strip()}
    written = []

    # 5. GLB export
    if 'glb' in emit:
        glb_path = os.path.join(os.path.abspath(args.out), f'{args.name}.glb')
        glb_export.export_glb(glb_path, armature=rpm_arm)
        written.append(glb_path)

    # 6. VRM export
    if 'vrm' in emit:
        vrm_path = os.path.join(os.path.abspath(args.out), 'vrm', f'{args.name}.vrm')
        vrm_export.export_vrm(vrm_path, rpm_arm, body)
        written.append(vrm_path)

    return written


def _preflight_contract(armature, body):
    """Assert bones + morphs exist in-Blender (mirrors validate_avatar.mjs)."""
    bone_names = {b.name for b in armature.data.bones}
    missing_bones = [b for b in RPM_CONTRACT_BONES if b not in bone_names]
    if missing_bones:
        raise RuntimeError(f'[preflight] missing RPM contract bones: {missing_bones}')

    morphs = set()
    if body.data.shape_keys:
        morphs = {kb.name for kb in body.data.shape_keys.key_blocks}
    missing_vis = [v for v in OCULUS_VISEMES if v not in morphs]
    missing_ark = [m for m in ARKIT_CONTRACT_MORPHS if m not in morphs]
    if missing_vis:
        raise RuntimeError(f'[preflight] missing visemes: {missing_vis}')
    if missing_ark:
        raise RuntimeError(f'[preflight] missing ARKit morphs: {missing_ark}')
    print('[preflight] rig contract satisfied (bones + visemes + ARKit morphs)')


def main():
    args = parse_args()
    try:
        written = build_avatar(args)
    except Exception:  # noqa: BLE001
        traceback.print_exc()
        print('\n[generate_avatar] FAILED — see traceback above.', file=sys.stderr)
        sys.exit(1)

    print('\n[generate_avatar] done. Wrote:')
    for w in written:
        print('  ', w)
    print('\nNext: validate with '
          '`node pipeline/validate_avatar.mjs <path>` before shipping.')


if __name__ == '__main__':
    main()
