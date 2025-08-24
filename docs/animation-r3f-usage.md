# React Three Fiber Animation Service Usage

The animation service has been updated to work seamlessly with React Three Fiber. Here's how to use it:

## Basic Setup

```tsx
import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { useAnimationService } from '../services/animation/useAnimationService'

function AnimatedAvatar() {
  const avatarRef = useRef()
  const { scene, animations } = useGLTF('/path/to/avatar.glb')
  const { actions, mixer } = useAnimations(animations, avatarRef)
  const animationService = useAnimationService()

  // Setup the animation service with R3F
  useEffect(() => {
    if (actions && mixer && animationService) {
      // Filter out null actions (R3F can return null for some actions)
      const validActions = {}
      Object.entries(actions).forEach(([name, action]) => {
        if (action) {
          validActions[name] = action
        }
      })
      
      // Setup with R3F actions and mixer
      animationService.actions.setupForR3F(validActions, mixer, avatarRef.current)
    }
  }, [actions, mixer, animationService])

  // Update animations in the frame loop
  useFrame((_, delta) => {
    if (animationService) {
      animationService.actions.updateForR3F(delta)
    }
  })

  return <primitive ref={avatarRef} object={scene} />
}
```

## Key Changes from Vanilla Three.js

### Old Way (Deprecated)
```tsx
// Don't use these methods for R3F projects
animationService.actions.setupForThreeJS(avatar, animations)
animationService.actions.applyToThreeJS()
animationService.actions.updateMixer(deltaTime)
```

### New R3F Way
```tsx
// Use these methods for R3F projects
animationService.actions.setupForR3F(actions, mixer, avatar)
animationService.actions.updateForR3F(delta) // Call this in useFrame
```

## Features

- **Automatic personality-based animation cycling**
- **Smooth transitions between animations**
- **Integration with useFrame for optimal performance**
- **Support for custom animation triggers**
- **Personality configuration system**

## Personality System

```tsx
// Set different personalities
animationService.actions.setPersonality('friendly')
animationService.actions.setPersonality('professional')
animationService.actions.setPersonality('energetic')

// Trigger specific animations
animationService.actions.performAction({
  clipName: 'wave',
  personality: 'friendly',
  immediate: false
})
```

## Animation Control

```tsx
// Enable/disable automatic cycling
animationService.actions.enableCycling(true)

// Get current animation info
const info = animationService.getters.getCurrentInfo()
console.log(info.currentClip?.name)
console.log(info.personality)
console.log(info.isTransitioning)
```

## Integration with Other Services

The animation service works alongside viseme and emote services:

```tsx
useFrame((_, delta) => {
  // Update all services
  if (animationService) {
    animationService.actions.updateForR3F(delta)
  }
  
  if (visemeService) {
    visemeService.actions.updateVisemes(performance.now())
    visemeService.actions.applyToRig(performance.now())
  }
  
  if (emoteService) {
    emoteService.actions.update(performance.now())
  }
})
```

## Performance Tips

1. **Use useFrame**: Always call `updateForR3F` in the `useFrame` hook for optimal performance
2. **Filter null actions**: R3F's `useAnimations` can return null actions, so filter them out
3. **Avoid redundant setup**: Only call `setupForR3F` when dependencies change
4. **Monitor performance**: Use the built-in performance monitoring if needed

## Migration Guide

If you're migrating from the old Three.js setup:

1. Replace `setupForThreeJS` with `setupForR3F`
2. Replace `updateMixer` and `applyToThreeJS` with `updateForR3F`
3. Use `useAnimations` hook instead of manually creating mixers
4. Call updates in `useFrame` instead of manual animation loops

The old methods are deprecated but still available for backward compatibility.
