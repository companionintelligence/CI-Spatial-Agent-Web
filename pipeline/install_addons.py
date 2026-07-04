"""One-time headless install/enable of the addons the pipeline needs.

Enables HumGen3D + the VRM addon, points HumGen at its content library, and
saves user preferences so subsequent ``blender --background`` runs find them.

Usage
-----
    "/Applications/Blender 4.5.app/Contents/MacOS/Blender" \
        --background --python pipeline/install_addons.py -- \
        [--humgen-zip /path/HumGen3D_v4_0_27.zip] \
        [--vrm-zip /path/VRM_Addon_for_Blender-*.zip] \
        [--content-path "~/Documents/HumGen"]

If an addon is already installed you can omit its ``--*-zip`` flag; this script
will just enable it. Missing addons produce a clear, actionable error rather
than a silent skip.
"""

import argparse
import os
import sys

try:
    import bpy
    import addon_utils
except ImportError:
    print('ERROR: run this with Blender: '
          '"/Applications/Blender 4.5.app/Contents/MacOS/Blender" --background '
          '--python pipeline/install_addons.py -- ...', file=sys.stderr)
    raise

HUMGEN_MODULE = 'HumGen3D'
VRM_MODULE = 'io_scene_vrm'


def _argv_after_ddash():
    argv = sys.argv
    return argv[argv.index('--') + 1:] if '--' in argv else []


def parse_args():
    p = argparse.ArgumentParser(description='Install/enable pipeline addons in Blender.')
    p.add_argument('--humgen-zip', default=None, help='Path to HumGen3D_v4_0_27.zip')
    p.add_argument('--vrm-zip', default=None, help='Path to VRM-Addon-for-Blender zip')
    p.add_argument('--content-path', default=None,
                   help='HumGen content library path (where .hgpack packs are installed)')
    return p.parse_args(_argv_after_ddash())


def _install_zip(zip_path):
    if not zip_path:
        return
    zip_path = os.path.expanduser(zip_path)
    if not os.path.exists(zip_path):
        raise FileNotFoundError(f'addon zip not found: {zip_path}')
    print(f'[install] installing addon from {zip_path}')
    bpy.ops.preferences.addon_install(filepath=zip_path, overwrite=True)


def _enable(module):
    try:
        bpy.ops.preferences.addon_enable(module=module)
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(
            f'failed to enable addon {module!r}: {e}\n'
            f'Install it first (pass the --*-zip flag) — see pipeline/README.md.'
        ) from e
    # verify it actually loaded
    loaded = {m.__name__ for m in addon_utils.modules()}
    if module not in loaded and module not in bpy.context.preferences.addons:
        raise RuntimeError(
            f'addon {module!r} did not load after enable — check the zip is the '
            f'correct build for Blender 4.5 (see pipeline/README.md).'
        )
    print(f'[install] enabled {module}')


def _set_humgen_content_path(content_path):
    if not content_path:
        print('[install] no --content-path given; HumGen will use its default. '
              'Human generation FAILS without the .hgpack packs installed there '
              '(see docs/DRIVE-ASSETS.md).')
        return
    content_path = os.path.expanduser(content_path)
    os.makedirs(content_path, exist_ok=True)
    prefs = bpy.context.preferences.addons.get(HUMGEN_MODULE)
    if prefs is None:
        raise RuntimeError('HumGen3D not enabled — cannot set content path')
    # TODO: verify against installed addon. v4 stores the library path in the
    # addon preferences; the attribute has been named 'filepath' /
    # 'filepath_' / 'content_path' across versions. Try the known candidates.
    p = prefs.preferences
    for attr in ('filepath', 'filepath_', 'content_path', 'content_filepath'):
        if hasattr(p, attr):
            setattr(p, attr, content_path)
            print(f'[install] set HumGen content path ({attr}) -> {content_path}')
            return
    print('[install] WARNING: could not find HumGen content-path preference '
          'attribute — set it once in the UI, or verify the attr name and update '
          'install_addons.py.')


def main():
    args = parse_args()

    _install_zip(args.humgen_zip)
    _install_zip(args.vrm_zip)

    _enable(HUMGEN_MODULE)
    _enable(VRM_MODULE)

    _set_humgen_content_path(args.content_path)

    # persist so `blender --background` (without --factory-startup) finds them.
    bpy.ops.wm.save_userpref()
    print('[install] saved user preferences. Addons ready.')
    print('[install] NOTE: generate_avatar.py runs with --factory-startup for '
          'reproducibility, which ignores saved prefs — it re-enables the addons '
          'itself. This script is for interactive/BlenderMCP sessions and to '
          'validate the install.')


if __name__ == '__main__':
    main()
