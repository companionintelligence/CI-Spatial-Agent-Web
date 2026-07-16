"""Main entry — generate one avatar (GLB and/or VRM) headlessly.

Orchestrates the full Strategy-R (retarget) flow:

    clothed HumGen human  ->  bind face morphs  ->  bake skin textures
                          ->  RETARGET native rig to RPM clip skeleton
                          ->  GLB export  (+  VRM export)

Strategy R keeps HumGen's native rig intact (body + head + eyes + teeth + clothing
all bound to it as HumGen authored) and makes the app's shared RPM clips drive it by
aligning its rest to the RPM T-pose and renaming its bones to the RPM names. No
re-skin, no head/teeth/eye re-seating — so the head stays attached, teeth stay in
the mouth, and sleeves follow the arms without exploding. See lib/skeleton.py.

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

# --- make `pipeline/` and `pipeline/lib/` importable regardless of Blender's cwd
# (mappings.py lives in pipeline/; the step modules live in pipeline/lib/ and
# import each other + mappings as flat modules). ---
_PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
_LIB_DIR = os.path.join(_PIPELINE_DIR, 'lib')
for _p in (_LIB_DIR, _PIPELINE_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

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


def _enable_addons(content_path, want_vrm=False):
    """Enable HumGen3D (required) + the VRM addon (optional).

    HumGen3D is hard-required. The VRM addon (``io_scene_vrm``) is only needed for
    ``--emit vrm``; if it isn't installed we warn and continue so the GLB path
    still runs (the VRM addon ships separately from HumGen).
    """
    try:
        bpy.ops.preferences.addon_enable(module='HumGen3D')
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(
            f'could not enable HumGen3D: {e}. Run pipeline/install_addons.py '
            f'first (see pipeline/README.md).'
        ) from e

    try:
        bpy.ops.preferences.addon_enable(module='io_scene_vrm')
    except Exception as e:  # noqa: BLE001
        if want_vrm:
            raise RuntimeError(
                f'could not enable io_scene_vrm (needed for --emit vrm): {e}. '
                f'Install the VRM addon (see pipeline/README.md §3).'
            ) from e
        print(f'[generate_avatar] VRM addon unavailable ({e}); GLB-only run continues.')
    if content_path:
        # best-effort content path set (see install_addons.py for the caveat).
        # HumGen concatenates `str(pref.filepath) + relative_path` RAW (no
        # os.path.join) in several places (e.g. hair/basehair.py), so the path
        # MUST end with a separator or you get `/HumGen_contenthair/...`.
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


# ---------------------------------------------------------------------------
# orchestration
# ---------------------------------------------------------------------------

def build_avatar(args):
    import humgen
    import skeleton
    import facemorphs
    import glb_export
    import vrm_export

    emit = {e.strip().lower() for e in args.emit.split(',') if e.strip()}

    _reset_scene()
    if not args.skip_addon_enable:
        _enable_addons(args.content_path, want_vrm=('vrm' in emit))

    # 1. generate the HumGen human
    human = humgen.generate_human(seed=args.seed, gender=args.gender, height=args.height)
    body = humgen.get_body_object(human)

    # 2. dress it — outfit + footwear on the NATIVE rig (Strategy R keeps it there).
    humgen.apply_clothing(human, gender=args.gender, seed=args.seed)

    # 2b. convert particle scalp hair to an exportable haircard mesh bound to the
    #     head bone (glTF can't export particle hair; without this the avatar is bald).
    humgen.convert_hair_to_mesh(human)

    # 3. bind face morphs (ARKit + visemes) — MUST run while the HumGen rig is still
    #    native (load_facial_rig / prepare_for_arkit depend on it). Bakes the
    #    viseme_* + ARKit shape keys onto the body. Shape keys are rig-independent,
    #    so they survive the retarget (rest-align + rename) untouched.
    facemorphs.bind_all(body, human=human)

    # 4. bake HumGen's procedural skin to textures before export (the raw glTF
    #    exporter can't run HumGen's on-export bake, and unbaked skin exports empty).
    #    First strip the body's clothing geometry-masks so nothing bakes black under
    #    the clothing. Bake into a temp subdir — PNGs get embedded into the GLB.
    humgen.unmask_body_for_bake(human)
    _bake_dir = os.path.join(os.path.abspath(args.out), f'.bake_{args.name}')
    glb_export.bake_textures(human, _bake_dir, samples=16)

    # 5. Strategy R — align HumGen's native rest to the RPM T-pose and rename its
    #    bones to the RPM names. Head/eyes/teeth/clothing stay coherently bound.
    rpm_arm, body = skeleton.retarget_to_rpm(args.gender, human=human)

    # 6. sanity-check the rig contract in-Blender before we export
    _preflight_contract(rpm_arm, body)

    written = []

    # 7. GLB export
    if 'glb' in emit:
        glb_path = os.path.join(os.path.abspath(args.out), f'{args.name}.glb')
        glb_export.export_glb(glb_path, armature=rpm_arm)
        written.append(glb_path)

    # 8. VRM export
    if 'vrm' in emit:
        vrm_path = os.path.join(os.path.abspath(args.out), 'vrm', f'{args.name}.vrm')
        vrm_export.export_vrm(vrm_path, rpm_arm, body)
        written.append(vrm_path)

    # 9. clean up the intermediate baked-texture dir (PNGs are embedded in the GLB)
    try:
        import shutil
        if os.path.isdir(_bake_dir):
            shutil.rmtree(_bake_dir)
    except Exception as e:  # noqa: BLE001
        print(f'[generate_avatar] could not remove bake dir {_bake_dir}: {e}')

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
