"""Headless import of HumGen3D ``.hgpack`` content packs.

HumGen's UI installs content packs through a file-select popup
(``hg3d.cpackselect``) that fills ``context.scene.installpacks_col`` and an
install operator (``hg3d.cpackinstall``) that unzips each queued pack into the
content ``filepath`` and records its file list in the pack's ``content_packs/*.json``.
That popup can't run ``--background``, so this script replicates the select step
programmatically (add each ``.hgpack`` to ``installpacks_col`` with its in-zip
``content_packs/*.json`` path and ``alert="None"``) and then invokes
``hg3d.cpackinstall`` — the exact same install path the GUI uses, no reimplementation.

VERIFIED against HumGen3D v4.0.29 + Blender 4.5.6 LTS. All six V4 packs
(Base_Humans, Base_Poses, Base_Hair, Base_Clothes, DPL_HGV4_Collection,
8K_Textures) import cleanly this way.

Usage
-----
    "/Applications/Blender 4.5.app/Contents/MacOS/Blender" \
        --background --python pipeline/import_content_packs.py -- \
        ~/Desktop/BlenderTools/Base_Humans_V4_1.hgpack \
        ~/Desktop/BlenderTools/Base_Poses_V4_0.hgpack \
        ~/Desktop/BlenderTools/Base_Hair_V4_1.hgpack \
        ~/Desktop/BlenderTools/Base_Clothes_V4_1.hgpack \
        ~/Desktop/BlenderTools/DPL_HGV4_Collab_V6_01.hgpack \
        ~/Desktop/BlenderTools/8K_Textures_OPTIONAL_V4_0.hgpack

Notes
-----
* Run ``install_addons.py`` first (enables HumGen3D and sets the content path).
  This script reads the content path from the saved prefs, so do NOT pass
  ``--factory-startup``.
* ``Base_Hair`` is effectively required: the shipped human presets in
  ``Base_Humans`` reference hair assets (e.g. ``Slicked Back.json``), so
  ``Human.from_preset(...)`` raises ``FileNotFoundError`` until hair is imported.
* Ignore the startup ``HumGenException: Filepath selected, but no humans found in
  path`` — it's the addon's on-load handler running before the packs are present;
  it does not affect the import (the operator still returns ``{'FINISHED'}``).
* The packs unzip a junk ``__MACOSX/`` folder into the content dir (macOS zip
  artifact). It's harmless; delete it if you want a clean tree.
"""

import os
import sys
import zipfile

import bpy


def _argv_after_ddash():
    argv = sys.argv
    return argv[argv.index('--') + 1:] if '--' in argv else []


def _json_path_in_zip(zip_path):
    """Return the in-zip path of the pack's content_packs/*.json descriptor."""
    with zipfile.ZipFile(zip_path) as zf:
        cpack_json_files = [f for f in zf.namelist() if f.startswith('content_packs')]
    return next(
        (f for f in cpack_json_files if os.path.splitext(f)[1] == '.json'), None
    )


def main():
    packs = [os.path.expanduser(p) for p in _argv_after_ddash()]
    if not packs:
        print('ERROR: pass one or more .hgpack paths after `--`.', file=sys.stderr)
        sys.exit(1)

    if 'HumGen3D' not in bpy.context.preferences.addons:
        bpy.ops.preferences.addon_enable(module='HumGen3D')

    from HumGen3D.backend.preferences.preference_func import get_prefs

    filepath = get_prefs().filepath
    if not filepath:
        raise RuntimeError(
            'HumGen content path not set — run install_addons.py --content-path first.'
        )
    print(f'[import] content filepath: {filepath!r}')

    coll = bpy.context.scene.installpacks_col
    coll.clear()

    for zip_path in packs:
        if not os.path.exists(zip_path):
            raise FileNotFoundError(zip_path)
        json_path = _json_path_in_zip(zip_path)
        if not json_path:
            raise RuntimeError(f'{zip_path}: no content_packs/*.json — not a valid .hgpack')
        print(f'[import] queue {os.path.basename(zip_path)}  json={json_path}')
        item = coll.add()
        item.name = zip_path          # HG_INSTALL_CPACK reads zip_path.name
        item.pack_name = zip_path
        item.json_path = json_path    # ...and zip_path.json_path
        item.alert = 'None'           # only alert=="None" items are installed

    print('[import] running hg3d.cpackinstall ...')
    result = bpy.ops.hg3d.cpackinstall()
    print(f'[import] operator result: {result}')

    cp_dir = os.path.join(filepath, 'content_packs')
    if os.path.isdir(cp_dir):
        installed = sorted(f for f in os.listdir(cp_dir) if f.endswith('.json'))
        print(f'[import] {len(installed)} content pack(s) now registered:')
        for f in installed:
            print(f'    {f}')
    else:
        print(f'[import] WARNING: no content_packs dir at {cp_dir}')


if __name__ == '__main__':
    main()
