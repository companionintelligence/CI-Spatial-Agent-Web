"""Name/bind mapping tables for the CI avatar pipeline.

Three consumers rely on these tables:

  * ``skeleton.py``     — reparents/renames the HumGen mesh onto the RPM skeleton
                          (``RPM_TO_VRM_HUMANBONES`` doubles as the canonical
                          RPM bone inventory + the VRM humanoid bind list).
  * ``facemorphs.py``   — renames HumGen shape keys to the app's morph names
                          (``HUMGEN_TO_OCULUS_VISEME`` + ``HUMGEN_TO_ARKIT``).
  * ``vrm_export.py``   — binds VRM expressions to the renamed morphs
                          (``VRM_EXPRESSION_BINDS``).

VERIFIED vs. UNVERIFIED
-----------------------
* ``RPM_TO_VRM_HUMANBONES``, ``RPM_BONES``, ``RPM_CONTRACT_BONES`` — **VERIFIED**
  by parsing the RPM T-pose GLBs on disk
  (``/Users/liam/devel/3d/animation-library-master/{masculine,feminine}/glb/*_TPose.glb``)
  and cross-checked against the shipping ``rpm-mixamo-t-posed.glb`` in-app.
* ``OCULUS_VISEMES`` (15) and ``ARKIT_MORPHS`` (the app's ARKit-52 target set) —
  **VERIFIED** against the shipping ``25-1-3_CI_model_male_Greg.glb`` (the
  reference RPM export the rig contract is drawn from) and the TypeScript
  service types (``visemeTypes.ts`` / ``emoteTypes.ts``).
* ``HUMGEN_TO_OCULUS_VISEME`` and ``HUMGEN_TO_ARKIT`` — **NOT VERIFIED**. HumGen3D
  advertises FACS/ARKit shape keys, but the exact source key names must be read
  off the *installed* HumGen mesh. Entries below are best-guesses; every one is
  flagged. Author the real table via BlenderMCP against the installed addon
  (see ASSET-PIPELINE.md §6.2).
"""

# ---------------------------------------------------------------------------
# Skeleton — RPM/Mixamo bone naming  (VERIFIED)
# ---------------------------------------------------------------------------

# RPM bone name  ->  VRM 1.0 humanoid bone name.
# Source of truth: joints[] of Masculine_TPose.glb / Feminine_TPose.glb.
# Feminine rig adds Thumb4/Pinky4 leaf bones the masculine rig omits; both are
# listed and simply resolve to no VRM humanoid slot (value None) when absent.
RPM_TO_VRM_HUMANBONES = {
    # --- spine / head (the rig contract core) ---
    'Hips': 'hips',
    'Spine': 'spine',
    'Spine1': 'chest',
    'Spine2': 'upperChest',
    'Neck': 'neck',
    'Head': 'head',
    'LeftEye': 'leftEye',
    'RightEye': 'rightEye',

    # --- left arm ---
    'LeftShoulder': 'leftShoulder',
    'LeftArm': 'leftUpperArm',
    'LeftForeArm': 'leftLowerArm',
    'LeftHand': 'leftHand',

    # --- left hand fingers ---
    'LeftHandThumb1': 'leftThumbMetacarpal',
    'LeftHandThumb2': 'leftThumbProximal',
    'LeftHandThumb3': 'leftThumbDistal',
    'LeftHandThumb4': None,   # leaf (feminine rig only) — no VRM slot
    'LeftHandIndex1': 'leftIndexProximal',
    'LeftHandIndex2': 'leftIndexIntermediate',
    'LeftHandIndex3': 'leftIndexDistal',
    'LeftHandIndex4': None,   # leaf (masculine rig) — no VRM slot
    'LeftHandMiddle1': 'leftMiddleProximal',
    'LeftHandMiddle2': 'leftMiddleIntermediate',
    'LeftHandMiddle3': 'leftMiddleDistal',
    'LeftHandRing1': 'leftRingProximal',
    'LeftHandRing2': 'leftRingIntermediate',
    'LeftHandRing3': 'leftRingDistal',
    'LeftHandPinky1': 'leftLittleProximal',
    'LeftHandPinky2': 'leftLittleIntermediate',
    'LeftHandPinky3': 'leftLittleDistal',
    'LeftHandPinky4': None,   # leaf (feminine rig only) — no VRM slot

    # --- right arm ---
    'RightShoulder': 'rightShoulder',
    'RightArm': 'rightUpperArm',
    'RightForeArm': 'rightLowerArm',
    'RightHand': 'rightHand',

    # --- right hand fingers ---
    'RightHandThumb1': 'rightThumbMetacarpal',
    'RightHandThumb2': 'rightThumbProximal',
    'RightHandThumb3': 'rightThumbDistal',
    'RightHandThumb4': None,
    'RightHandIndex1': 'rightIndexProximal',
    'RightHandIndex2': 'rightIndexIntermediate',
    'RightHandIndex3': 'rightIndexDistal',
    'RightHandIndex4': None,
    'RightHandMiddle1': 'rightMiddleProximal',
    'RightHandMiddle2': 'rightMiddleIntermediate',
    'RightHandMiddle3': 'rightMiddleDistal',
    'RightHandRing1': 'rightRingProximal',
    'RightHandRing2': 'rightRingIntermediate',
    'RightHandRing3': 'rightRingDistal',
    'RightHandPinky1': 'rightLittleProximal',
    'RightHandPinky2': 'rightLittleIntermediate',
    'RightHandPinky3': 'rightLittleDistal',
    'RightHandPinky4': None,

    # --- left leg ---
    'LeftUpLeg': 'leftUpperLeg',
    'LeftLeg': 'leftLowerLeg',
    'LeftFoot': 'leftFoot',
    'LeftToeBase': 'leftToes',
    'LeftToe_End': None,      # leaf — no VRM slot

    # --- right leg ---
    'RightUpLeg': 'rightUpperLeg',
    'RightLeg': 'rightLowerLeg',
    'RightFoot': 'rightFoot',
    'RightToeBase': 'rightToes',
    'RightToe_End': None,     # leaf — no VRM slot
}

# Full RPM bone inventory (superset of both rigs), in hierarchy order.
RPM_BONES = list(RPM_TO_VRM_HUMANBONES.keys())

# The subset the app's GLB gaze/emote/head-finder services look up BY NAME.
# validate_avatar.mjs asserts every one of these is present in an export.
# (AvatarModel.tsx head-finder: first bone whose name includes 'head';
#  gazeService.ts: bones.neck / bones.head / eyes — matched case-insensitively.)
RPM_CONTRACT_BONES = [
    'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftEye', 'RightEye',
]

# HumGen's own rig root name — Strategy D deletes this armature after weight
# transfer. NEEDS VERIFICATION against installed HumGen (v4 names its rig
# object like 'HG_<name>' with an armature data block); skeleton.py locates it
# by "armature that is NOT the imported RPM armature" rather than by name.
HUMGEN_RIG_HINT = 'HG_'


# ---------------------------------------------------------------------------
# Visemes — Oculus 15 set  (VERIFIED against Greg.glb + visemeTypes.ts)
# ---------------------------------------------------------------------------

# NB: visemeTypes.ts VisemeTarget defines 14 (no viseme_sil), but the loader in
# AvatarModel.tsx collects EVERY morph whose name startsWith('viseme_'), and the
# shipping Greg.glb ships all 15 including viseme_sil (silence/rest). We emit all
# 15 to match the RPM export profile exactly.
OCULUS_VISEMES = [
    'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD',
    'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR',
    'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U',
]

# HumGen shape-key name  ->  Oculus viseme name.
# NEEDS VERIFICATION against installed HumGen mesh shape keys. HumGen ships a
# FACS-oriented set, NOT Oculus visemes, so most of these must be *synthesised*
# (driven from jaw/lip FACS keys) rather than 1:1 renamed. Best-guess source
# keys below; confirm real names via BlenderMCP:
#   >>> [k.name for k in human.body_obj.data.shape_keys.key_blocks]
HUMGEN_TO_OCULUS_VISEME = {
    # rest / silence — usually the basis, no source key
    'viseme_sil': None,                      # NEEDS VERIFICATION: rest pose, synth from neutral
    'viseme_PP': 'MouthClose',               # NEEDS VERIFICATION: bilabial closure
    'viseme_FF': 'MouthFunnel',              # NEEDS VERIFICATION: labiodental
    'viseme_TH': 'JawOpen',                  # NEEDS VERIFICATION: dental (synth: small jaw + tongue)
    'viseme_DD': 'JawOpen',                  # NEEDS VERIFICATION: alveolar
    'viseme_kk': 'JawOpen',                  # NEEDS VERIFICATION: velar
    'viseme_CH': 'MouthPucker',              # NEEDS VERIFICATION: palato-alveolar
    'viseme_SS': 'MouthStretch',             # NEEDS VERIFICATION: alveolar fricative
    'viseme_nn': 'MouthClose',               # NEEDS VERIFICATION: nasal
    'viseme_RR': 'MouthPucker',              # NEEDS VERIFICATION: trill
    'viseme_aa': 'JawOpen',                  # NEEDS VERIFICATION: open vowel
    'viseme_E': 'MouthStretch',              # NEEDS VERIFICATION: mid-front vowel
    'viseme_I': 'MouthStretch',              # NEEDS VERIFICATION: close-front vowel
    'viseme_O': 'MouthFunnel',               # NEEDS VERIFICATION: mid-back vowel
    'viseme_U': 'MouthPucker',               # NEEDS VERIFICATION: close-back vowel
}


# ---------------------------------------------------------------------------
# Facial morphs — ARKit set  (target names VERIFIED against Greg.glb)
# ---------------------------------------------------------------------------

# The morph names the app's GLB emote collector keeps (it keeps any morph whose
# name includes eye/brow/mouth/nose/cheek/jaw). This is the exact set present in
# the shipping Greg.glb (RPM's ARKit-52 + a few RPM extras). emoteTypes.ts
# FacialTarget is the consumer; names here are ARKit blendshape spellings.
ARKIT_MORPHS = [
    # eyes
    'eyeBlinkLeft', 'eyeBlinkRight', 'eyeSquintLeft', 'eyeSquintRight',
    'eyeWideLeft', 'eyeWideRight',
    'eyeLookDownLeft', 'eyeLookDownRight', 'eyeLookUpLeft', 'eyeLookUpRight',
    'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight',
    'eyesClosed', 'eyesLookUp', 'eyesLookDown',
    # brows
    'browDownLeft', 'browDownRight', 'browInnerUp',
    'browOuterUpLeft', 'browOuterUpRight',
    # jaw
    'jawForward', 'jawLeft', 'jawRight', 'jawOpen',
    # mouth
    'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
    'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
    'mouthDimpleLeft', 'mouthDimpleRight',
    'mouthStretchLeft', 'mouthStretchRight',
    'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
    'mouthPressLeft', 'mouthPressRight',
    'mouthLowerDownLeft', 'mouthLowerDownRight',
    'mouthUpperUpLeft', 'mouthUpperUpRight',
    'mouthOpen', 'mouthSmile',
    # cheeks
    'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
    # nose
    'noseSneerLeft', 'noseSneerRight',
    # tongue
    'tongueOut',
]

# The stricter ARKit-52 subset that emoteTypes.ts FacialTarget references
# directly (validate_avatar.mjs asserts THIS is present; the fuller ARKIT_MORPHS
# above is what we aim to emit). Kept in sync with FacialTarget field names that
# correspond to real blendshapes (rotation-only fields like headRotateX are not
# morphs and are excluded).
ARKIT_CONTRACT_MORPHS = [
    'eyeBlinkLeft', 'eyeBlinkRight', 'eyeSquintLeft', 'eyeSquintRight',
    'eyeWideLeft', 'eyeWideRight', 'eyesClosed',
    'browDownLeft', 'browDownRight', 'browInnerUp',
    'browOuterUpLeft', 'browOuterUpRight',
    'jawForward',
    'mouthSmile', 'mouthFrownLeft', 'mouthFrownRight',
    'mouthDimpleLeft', 'mouthDimpleRight', 'mouthLeft',
    'mouthPressLeft', 'mouthStretchLeft', 'mouthStretchRight',
    'mouthShrugLower', 'mouthShrugUpper', 'mouthRollLower', 'mouthRollUpper',
    'mouthPucker', 'mouthFunnel', 'mouthClose',
    'mouthUpperUpLeft', 'mouthUpperUpRight',
    'noseSneerLeft', 'noseSneerRight',
    'cheekSquintLeft', 'cheekSquintRight',
]

# HumGen shape-key name  ->  ARKit morph name.
# NEEDS VERIFICATION against installed HumGen mesh shape keys. HumGen v4 exposes
# a FACS action-unit set (e.g. 'BrowDownLeft', 'JawOpen', 'MouthSmileLeft'...);
# the exact casing/spelling differs from ARKit and must be read off the installed
# mesh. Best-guess left-side sample below — extend to the full set once the real
# key list is dumped. Any ARKit name in ARKIT_MORPHS with no entry here will be
# emitted as an empty (zeroed) morph so the contract still validates.
HUMGEN_TO_ARKIT = {
    # eyes                                   # NEEDS VERIFICATION (whole block)
    'EyeBlinkLeft': 'eyeBlinkLeft',
    'EyeBlinkRight': 'eyeBlinkRight',
    'EyeSquintLeft': 'eyeSquintLeft',
    'EyeSquintRight': 'eyeSquintRight',
    'EyeWideLeft': 'eyeWideLeft',
    'EyeWideRight': 'eyeWideRight',
    # brows
    'BrowDownLeft': 'browDownLeft',
    'BrowDownRight': 'browDownRight',
    'BrowInnerUp': 'browInnerUp',
    'BrowOuterUpLeft': 'browOuterUpLeft',
    'BrowOuterUpRight': 'browOuterUpRight',
    # jaw
    'JawForward': 'jawForward',
    'JawOpen': 'jawOpen',
    'JawLeft': 'jawLeft',
    'JawRight': 'jawRight',
    # mouth
    'MouthClose': 'mouthClose',
    'MouthFunnel': 'mouthFunnel',
    'MouthPucker': 'mouthPucker',
    'MouthSmileLeft': 'mouthSmileLeft',
    'MouthSmileRight': 'mouthSmileRight',
    'MouthFrownLeft': 'mouthFrownLeft',
    'MouthFrownRight': 'mouthFrownRight',
    'MouthDimpleLeft': 'mouthDimpleLeft',
    'MouthDimpleRight': 'mouthDimpleRight',
    'MouthStretchLeft': 'mouthStretchLeft',
    'MouthStretchRight': 'mouthStretchRight',
    'MouthRollLower': 'mouthRollLower',
    'MouthRollUpper': 'mouthRollUpper',
    'MouthShrugLower': 'mouthShrugLower',
    'MouthShrugUpper': 'mouthShrugUpper',
    'MouthPressLeft': 'mouthPressLeft',
    'MouthPressRight': 'mouthPressRight',
    'MouthUpperUpLeft': 'mouthUpperUpLeft',
    'MouthUpperUpRight': 'mouthUpperUpRight',
    'MouthLowerDownLeft': 'mouthLowerDownLeft',
    'MouthLowerDownRight': 'mouthLowerDownRight',
    # cheeks
    'CheekPuff': 'cheekPuff',
    'CheekSquintLeft': 'cheekSquintLeft',
    'CheekSquintRight': 'cheekSquintRight',
    # nose
    'NoseSneerLeft': 'noseSneerLeft',
    'NoseSneerRight': 'noseSneerRight',
}


# ---------------------------------------------------------------------------
# VRM expression binds  (preset names VERIFIED against emoteTypes.ts)
# ---------------------------------------------------------------------------

# VRM 1.0 mouth expression presets (5) — the app auto-detects these on VRM
# avatars; visemesService.ts collapses the 15 Oculus visemes to these via
# OCULUS_TO_VRM_MAPPING. We bind each VRM preset to the morph(s) it should drive.
# VERIFIED collapse (mirrors visemesService.OCULUS_TO_VRM_MAPPING):
VRM_VISEME_PRESETS = {
    'aa': ['viseme_aa', 'viseme_TH', 'viseme_DD', 'viseme_RR'],
    'ee': ['viseme_E', 'viseme_I', 'viseme_FF', 'viseme_CH', 'viseme_SS'],
    'ih': ['viseme_kk', 'viseme_nn'],
    'oh': ['viseme_O'],
    'ou': ['viseme_U', 'viseme_PP'],
}

# VRM 1.0 emotion/blink expression presets — emoteTypes.ts VRM_EXPRESSIONS.
# Each maps to the ARKit morphs that best approximate the expression, used to
# author the VRM expression preset's morphTargetBinds. Weights are indicative;
# tune against the mesh.
VRM_EXPRESSION_BINDS = {
    'happy': {'mouthSmileLeft': 1.0, 'mouthSmileRight': 1.0, 'cheekSquintLeft': 0.6, 'cheekSquintRight': 0.6},
    'angry': {'browDownLeft': 1.0, 'browDownRight': 1.0, 'noseSneerLeft': 0.5, 'noseSneerRight': 0.5, 'mouthFrownLeft': 0.4, 'mouthFrownRight': 0.4},
    'sad': {'browInnerUp': 1.0, 'mouthFrownLeft': 0.8, 'mouthFrownRight': 0.8},
    'relaxed': {'mouthSmileLeft': 0.3, 'mouthSmileRight': 0.3},
    'surprised': {'browInnerUp': 0.8, 'browOuterUpLeft': 0.8, 'browOuterUpRight': 0.8, 'eyeWideLeft': 1.0, 'eyeWideRight': 1.0, 'jawOpen': 0.6},
    'blink': {'eyeBlinkLeft': 1.0, 'eyeBlinkRight': 1.0},
    'blinkLeft': {'eyeBlinkLeft': 1.0},
    'blinkRight': {'eyeBlinkRight': 1.0},
    'neutral': {},
}


def missing_arkit(present_names):
    """Return the ARKit contract morphs absent from ``present_names``.

    Used by generate_avatar.py to decide which zero-filled placeholder morphs
    to add so the export still satisfies the rig contract.
    """
    present = set(present_names)
    return [m for m in ARKIT_CONTRACT_MORPHS if m not in present]


def missing_visemes(present_names):
    """Return the Oculus visemes absent from ``present_names``."""
    present = set(present_names)
    return [v for v in OCULUS_VISEMES if v not in present]
