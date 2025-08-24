import type { AnimationClip } from '../animationTypes'

export const ANIMATION_CLIPS: AnimationClip[] = [
  // Idle animations

  {
    name: 'Basic VRM Idle',
    path: '/assets/animations/vrm/idle_loop.vrma',
    duration: 5000,
    weight: 1,
    blendTime: 1000,
    category: 'idle',
    priority: 1,
    loopCount: Infinity, // Infinite loops
    blendCurve: 'easeInOut',
    speed: 1
  },

  /*{
    name: 'Basic Idle',
    path: '/assets/animations/basic-idle.glb',
    duration: 5000,
    weight: 1,
    blendTime: 1000,
    category: 'idle',
    priority: 1,
    loopCount: Infinity, // Infinite loops
    blendCurve: 'easeInOut',
    speed: 1
  }*/
  /*
  {
    name: 'Warrior Idle',
    path: '/assets/animations/warrior-idle.glb',
    duration: 8000,

    weight: 1,
    blendTime: 1500,
    category: 'idle',
    priority: 2,
    loopCount: Infinity,
    speed: 1
  },
  {
    name: 'Unarmed Idle',
    path: '/assets/animations/unarmed-idle.glb',
    duration: 7000,

    weight: 1,
    blendTime: 1200,
    category: 'idle',
    priority: 2,
    loopCount: Infinity,
    speed: 1
  },
  {
    name: 'Idle',
    path: '/assets/animations/idle.glb',
    duration: 8000,
    weight: 1,
    blendTime: 1500,
    category: 'idle',
    priority: 2,
    loopCount: Infinity,
    speed: 1
  },

  // Gesture animations
  {
    name: 'Waving',
    path: '/assets/animations/Waving.glb',
    duration: 3000,

    weight: .3,
    blendTime: 500,
    category: 'gesture',
    priority: 3,
    loopCount: 1, // Play once
    blendCurve: 'easeOut',
    speed: .4
  },
  {
    name: 'Clapping',
    path: '/assets/animations/Clapping.glb',
    duration: 2000,

    weight: 0.2,
    blendTime: 400,
    category: 'gesture',
    priority: 3,
    loopCount: 4,// 3
    blendCurve: 'bounce',
    speed: .4
  },
  {
    name: 'Agreeing',
    path: '/assets/animations/Agreeing.glb',
    duration: 3500,

    weight: 0.2,
    blendTime: 500,
    category: 'gesture',
    priority: 1,
    loopCount: 1,
    speed: .75
  },
  {
    name: 'Head Gesture',
    path: '/assets/animations/Head-Gesture.glb',
    duration: 2500,

    weight: 0.7,
    blendTime: 400,
    category: 'gesture',
    priority: 1,
    loopCount: 0,
    speed: .6
  },
  {
    name: 'Whatever Gesture',
    path: '/assets/animations/Whatever-Gesture.glb',
    duration: 2000,
    weight: 0.3,
    blendTime: 500,
    category: 'gesture',
    priority: 2,
    loopCount: 1,
    speed: 0.8
  },
  {
    name: 'Arm Gesture',
    path: '/assets/animations/Arm-Gesture.glb',
    duration: 3000,
    weight: 0.4,
    blendTime: 600,
    category: 'gesture',
    priority: 2,
    loopCount: 1,
    speed: 0.7
  },
  {
    name: 'Happy Hand Gesture',
    path: '/assets/animations/Happy-Hand-Gesture.glb',
    duration: 2500,
    weight: 0.3,
    blendTime: 500,
    category: 'gesture',
    priority: 2,
    loopCount: 1,
    speed: 0.8
  },
  {
    name: 'Hands Forward Gesture',
    path: '/assets/animations/Hands-Forward-Gesture.glb',
    duration: 2000,
    weight: 0.4,
    blendTime: 400,
    category: 'gesture',
    priority: 3,
    loopCount: 1,
    speed: 0.9
  },
  {
    name: 'Crazy Gesture',
    path: '/assets/animations/Crazy-Gesture.glb',
    duration: 3500,
    weight: 0.5,
    blendTime: 700,
    category: 'gesture',
    priority: 4,
    loopCount: 1,
    speed: 0.6
  },
  {
    name: 'Pointing Forward',
    path: '/assets/animations/Pointing-Forward.glb',
    duration: 2500,
    weight: 0.4,
    blendTime: 500,
    category: 'gesture',
    priority: 2,
    loopCount: 1,
    speed: 0.8
  },

  {
    name: 'Spin',
    path: '/assets/animations/spin.glb',
    duration: 3000,

    weight: 0.3,
    blendTime: 1600,
    category: 'movement',
    priority: 4,
    loopCount: 1,
    speed: .8
  },


  // Expression animations
  {
    name: 'Thinking',
    path: '/assets/animations/Thinking.glb',
    duration: 4000,

    weight: 0.9,
    blendTime: 700,
    category: 'expression',
    priority: 2,
    loopCount: 1,
    speed: .5
  },
  {
    name: 'Surprised',
    path: '/assets/animations/Surprised.glb',
    duration: 2000,

    weight: 0.2,
    blendTime: 400,
    category: 'expression',
    priority: 2,
    loopCount: 1,
    speed: .9
  },
  {
    name: 'Reacting',
    path: '/assets/animations/Reacting.glb',
    duration: 2500,

    weight: 0.4,
    blendTime: 500,
    category: 'expression',
    priority: 2,
    loopCount: 1,
    speed: .7
  },
  {
    name: 'Telling A Secret',
    path: '/assets/animations/Telling-A-Secret.glb',
    duration: 4000,
    weight: 0.5,
    blendTime: 800,
    category: 'expression',
    priority: 3,
    loopCount: 1,
    speed: 0.7
  },
  {
    name: 'Cocky Head Turn',
    path: '/assets/animations/Cocky-Head-Turn.glb',
    duration: 2000,
    weight: 0.3,
    blendTime: 400,
    category: 'expression',
    priority: 2,
    loopCount: 1,
    speed: 0.9
  },
  {
    name: 'Looking',
    path: '/assets/animations/Looking.glb',
    duration: 3000,
    weight: 0.4,
    blendTime: 600,
    category: 'expression',
    priority: 1,
    loopCount: 1,
    speed: 0.8
  },
  {
    name: 'Looking 1',
    path: '/assets/animations/Looking-1.glb',
    duration: 3500,
    weight: 0.4,
    blendTime: 600,
    category: 'expression',
    priority: 1,
    loopCount: 1,
    speed: 0.8
  },
  {
    name: 'Looking Behind',
    path: '/assets/animations/Looking-Behind.glb',
    duration: 2500,
    weight: 0.3,
    blendTime: 500,
    category: 'expression',
    priority: 2,
    loopCount: 1,
    speed: 0.9
  },

  // Action animations
  {
    name: 'Dance',
    path: '/assets/animations/dance.glb',
    duration: 6000,

    weight: 0.7,
    blendTime: 1000,
    category: 'action',
    priority: 5,
    loopCount: 1,
    speed: .8
  },
  {
    name: 'Bow',
    path: '/assets/animations/bow.glb',
    duration: 3000,

    weight: 0.5,
    blendTime: 600,
    category: 'action',
    priority: 4,
    loopCount: 1,
    speed: 1
  },
  {
    name: 'Salute',
    path: '/assets/animations/Salute.glb',
    duration: 2500,

    weight: 0.5,
    blendTime: 500,
    category: 'action',
    priority: 4,
    loopCount: 1,
    speed: 1
  },
  {
    name: 'Dance Action',
    path: '/assets/animations/dance-action.glb',
    duration: 4000,
    weight: 0.6,
    blendTime: 1000,
    category: 'action',
    priority: 5,
    loopCount: 2,
    speed: 0.8
  },
  {
    name: 'Throw',
    path: '/assets/animations/throw.glb',
    duration: 2000,
    weight: 0.7,
    blendTime: 400,
    category: 'action',
    priority: 4,
    loopCount: 1,
    speed: 1.2
  },
  {
    name: 'Praying',
    path: '/assets/animations/Praying.glb',
    duration: 3000,
    weight: 0.5,
    blendTime: 800,
    category: 'action',
    priority: 3,
    loopCount: 1,
    speed: 0.7
  },
  {
    name: 'Shoulder Rubbing',
    path: '/assets/animations/Shoulder-Rubbing.glb',
    duration: 4000,
    weight: 0.4,
    blendTime: 700,
    category: 'action',
    priority: 3,
    loopCount: 2,
    speed: 0.8
  },
  {
    name: 'Shaking It Off',
    path: '/assets/animations/Shaking-It-Off.glb',
    duration: 3500,
    weight: 0.5,
    blendTime: 600,
    category: 'action',
    priority: 4,
    loopCount: 1,
    speed: 0.9
  },

  // Communication animations
  {
    name: 'Talking',
    path: '/assets/animations/Talking.glb',
    duration: 3000,
    weight: 0.3,
    blendTime: 500,
    category: 'communication',
    priority: 1,
    loopCount: 2,
    speed: 0.8
  },
  {
    name: 'Talking 1',
    path: '/assets/animations/Talking-1.glb',
    duration: 4000,
    weight: 0.3,
    blendTime: 600,
    category: 'communication',
    priority: 1,
    loopCount: 2,
    speed: 0.7
  },
  {
    name: 'Talking 2',
    path: '/assets/animations/Talking-2.glb',
    duration: 2500,
    weight: 0.3,
    blendTime: 400,
    category: 'communication',
    priority: 1,
    loopCount: 2,
    speed: 0.9
  }
  */
]

export const getAnimationClips = (): AnimationClip[] => {
  return ANIMATION_CLIPS
}

export const getClipsByCategory = (category: AnimationClip['category']): AnimationClip[] => {
  return ANIMATION_CLIPS.filter((clip) => clip.category === category)
}

export const getRandomClip = (category?: AnimationClip['category']): AnimationClip => {
  const clips = category ? getClipsByCategory(category) : ANIMATION_CLIPS
  return clips[Math.floor(Math.random() * clips.length)]
}

export const getClipsByPriority = (priority: number): AnimationClip[] => {
  return ANIMATION_CLIPS.filter((clip) => clip.priority <= priority)
}
