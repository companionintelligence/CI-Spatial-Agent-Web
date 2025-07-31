import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createSimpleStore, useSimpleStore } from '../utils/SimpleStore'

export const AvatarState = createSimpleStore({
  selectedAnimation: '/assets/animations/idle.glb',
  selectedModel: '/assets/avatars/25-1-3_CI_model_female_Shanee.glb'
})

export const AvatarOptions = [
  { label: 'Ash', value: '25-1-3_CI_model_female_Ash.glb' },
  { label: 'Greg', value: '25-1-3_CI_model_male_Greg.glb' },
  { label: 'Brit', value: '25-1-3_CI_model_female_Brit.glb' },
  { label: 'Jack', value: '25-1-3_CI_model_male_Jack.glb' },
  { label: 'Courtney', value: '25-1-3_CI_model_female_Courtney.glb' },
  { label: 'Liam', value: 'LiamCES2.glb' },
  { label: 'Glasses Short Hair', value: '25-1-3_CI_model_female_glasses_short_hair.glb' },
  { label: 'Liam CES', value: 'LiamCES.glb' },
  { label: 'Shanee', value: '25-1-3_CI_model_female_Shanee.glb' },
  { label: 'RPM Mixamo T-Pose', value: 'rpm-mixamo-t-posed.glb' },
  { label: 'Brad', value: '25-1-3_CI_model_male_Brad.glb ' },
  { label: 'Unbranded Woman Short Hair', value: 'unbranded-woman-short-hair.glb' }
]

export const AnimationOptions = [
  { label: 'Agreeing', value: '/assets/animations/Agreeing.glb' },
  { label: 'Arm Gesture', value: '/assets/animations/Arm-Gesture.glb' },
  { label: 'Basic Idle', value: '/assets/animations/basic-idle.glb' },
  { label: 'Bow', value: '/assets/animations/bow.glb' },
  { label: 'Clapping', value: '/assets/animations/Clapping.glb' },
  { label: 'Cocky Head Turn', value: '/assets/animations/Cocky-Head-Turn.glb' },
  { label: 'Crazy Gesture', value: '/assets/animations/Crazy-Gesture.glb' },
  { label: 'Dance Action', value: '/assets/animations/dance-action.glb' },
  { label: 'Dance', value: '/assets/animations/dance.glb' },
  { label: 'Hands Forward Gesture', value: '/assets/animations/Hands-Forward-Gesture.glb' },
  { label: 'Happy Hand Gesture', value: '/assets/animations/Happy-Hand-Gesture.glb' },
  { label: 'Head Gesture', value: '/assets/animations/Head-Gesture.glb' },
  { label: 'Idle', value: '/assets/animations/idle.glb' },
  { label: 'Idle Stable', value: '/assets/animations/idle-stable.glb' },
  { label: 'Looking 1', value: '/assets/animations/Looking-1.glb' },
  { label: 'Looking Behind', value: '/assets/animations/Looking-Behind.glb' },
  { label: 'Looking', value: '/assets/animations/Looking.glb' },
  { label: 'Neutral', value: '/assets/animations/neutral.json' },
  { label: 'Pointing Forward', value: '/assets/animations/Pointing-Forward.glb' },
  { label: 'Praying', value: '/assets/animations/Praying.glb' },
  { label: 'Reacting', value: '/assets/animations/Reacting.glb' },
  { label: 'Rename', value: '/assets/animations/rename.sh' },
  { label: 'Salute', value: '/assets/animations/Salute.glb' },
  { label: 'Shaking It Off', value: '/assets/animations/Shaking-It-Off.glb' },
  { label: 'Shoulder Rubbing', value: '/assets/animations/Shoulder-Rubbing.glb' },
  { label: 'Spin', value: '/assets/animations/spin.glb' },
  { label: 'Spin In Place', value: '/assets/animations/Spin-In-Place.glb' },
  { label: 'Standing Idle Watch', value: '/assets/animations/standing-idle-watch.glb' },
  { label: 'Surprised', value: '/assets/animations/Surprised.glb' },
  { label: 'Talking 1', value: '/assets/animations/Talking-1.glb' },
  { label: 'Talking 2', value: '/assets/animations/Talking-2.glb' },
  { label: 'Talking', value: '/assets/animations/Talking.glb' },
  { label: 'Telling A Secret', value: '/assets/animations/Telling-A-Secret.glb' },
  { label: 'Test', value: '/assets/animations/test.js' },
  { label: 'Think', value: '/assets/animations/think.glb' },
  { label: 'Thinking', value: '/assets/animations/Thinking.glb' },
  { label: 'Throw', value: '/assets/animations/throw.glb' },
  { label: 'Unarmed Idle', value: '/assets/animations/unarmed-idle.glb' },
  { label: 'Walking', value: '/assets/animations/walking.glb' },
  { label: 'Warrior Idle', value: '/assets/animations/warrior-idle.glb' },
  { label: 'Waving', value: '/assets/animations/Waving.glb' },
  { label: 'Whatever Gesture', value: '/assets/animations/Whatever-Gesture.glb' }
]

export const AvatarModel = () => {
  const group = useRef<THREE.Group>(null)

  const [state, setState] = useSimpleStore(AvatarState)

  const { selectedAnimation, selectedModel } = state
  const { scene: avatarScene } = useGLTF(selectedModel)
  const { animations } = useGLTF(selectedAnimation)

  const { actions, mixer } = useAnimations(animations, group)

  useEffect(() => {
    if (actions && Object.keys(actions).length > 0) {
      const actionNames = Object.keys(actions)
      const actionName = actionNames[0]
      const action = actions[actionName]

      if (action) {
        console.log(`Playing animation: ${actionName}`)
        action.reset()
        action.setLoop(THREE.LoopRepeat, Infinity)
        action.clampWhenFinished = false
        action.play()
      }
    }
  }, [actions, animations])

  useFrame((_, delta) => {
    if (mixer) {
      mixer.update(delta)
    }
  })

  return (
    <group ref={group}>
      <primitive object={avatarScene} />
    </group>
  )
}

useGLTF.preload('/assets/avatars/25-1-3_CI_model_female_Shanee.glb')
useGLTF.preload('/assets/animations/idle.glb')
