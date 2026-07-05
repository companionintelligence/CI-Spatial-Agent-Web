export const AvatarOptions = {
  Anselm: '/assets/avatars/rpm-mixamo-t-posed.glb',
  // The HumGen pipeline avatar — exported as native VRM 1.0 (VRM humanoid + expression
  // manager keep the head/teeth/eyes coherent; ARKit-52 as custom expressions). The
  // earlier RPM re-skin/retarget GLB was broken (floating teeth); this VRM stands,
  // animates, and lip-syncs. See docs/FACIAL-ANIMATION-PLAN.md + pipeline/generate_vrm.py.
  Aria: '/assets/avatars/humgen-aria-01.vrm',
  Ash: '/assets/avatars/25-1-3_CI_model_female_Ash.glb',
  Cara: '/assets/avatars/25-1-3_CI_model_female_Cara.glb',
  Greg: '/assets/avatars/25-1-3_CI_model_male_Greg.glb',
  Brit: '/assets/avatars/25-1-3_CI_model_female_Brit.glb',
  Jack: '/assets/avatars/25-1-3_CI_model_male_Jack.glb',
  Courtney: '/assets/avatars/25-1-3_CI_model_female_Courtney.glb',
  Liam: '/assets/avatars/LiamCES2.glb',
  'Glasses Short Hair': '/assets/avatars/25-1-3_CI_model_female_glasses_short_hair.glb',
  'Liam CES': '/assets/avatars/LiamCES.glb',
  Shanee: '/assets/avatars/25-1-3_CI_model_female_Shanee.glb',
  'RPM Mixamo T-Pose': '/assets/avatars/rpm-mixamo-t-posed.glb',
  Brad: '/assets/avatars/25-1-3_CI_model_male_Brad.glb',
  'Unbranded Woman Short Hair': '/assets/avatars/unbranded-woman-short-hair.glb',
  // Legacy VRoid / Reallusion / Mixamo VRM avatars — all validated against the
  // rig contract: humanoid (head/neck/hips) + mouth visemes (aa/ee/ih/oh/ou) +
  // emotion presets. VRM0 files are auto-migrated to VRM1 expression names by
  // @pixiv/three-vrm (a->aa, i->ih, u->ou, e->ee, o->oh).
  'Work Boy': '/assets/avatars/vrm/workboy.vrm', // VRM1 native
  'Casual Person': '/assets/avatars/vrm/casualperson.vrm', // VRM1 native
  Erik: '/assets/avatars/vrm/erik.vrm',
  Yuki: '/assets/avatars/vrm/yuki.vrm',
  'Sport Woman': '/assets/avatars/vrm/sportwoman.vrm',
  'Casual Man': '/assets/avatars/vrm/casualman.vrm',
  Scout: '/assets/avatars/vrm/scout.vrm',
  Maya: '/assets/avatars/vrm/maya.vrm',
  'Sport Boy': '/assets/avatars/vrm/sportboy.vrm',
  Kenji: '/assets/avatars/vrm/kenji.vrm'
}

export const AnimationOptions = {}
