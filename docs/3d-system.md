# 3D Avatar System

## Overview
The 3D avatar system uses React Three Fiber to render GLB avatar models with animations in a Three.js scene.

## Components

### AvatarModel
- Loads GLB avatar models from `/assets/avatars/`
- Supports separate animation files from `/assets/animations/`
- Handles animation playback with Three.js AnimationMixer
- Supports position and visibility controls

### Scene3D
- Main 3D scene container with Canvas
- Configurable camera, lighting, and environment
- OrbitControls for user interaction
- Ground plane for spatial reference

### AvatarViewport
- Wrapper component that integrates Scene3D into the UI
- Manages scene and avatar configuration

## Services

### sceneService
- Manages 3D scene configuration
- Controls avatar settings and position
- Provides hooks for React components

## Available Avatars
- Female avatars: Ash, Brit, Courtney, Shanee (glasses)
- Male avatars: Brad, Greg, Jack
- Additional: LiamCES models and unbranded options

## Available Animations
- Basic idle animations
- Talking animations
- Gesture animations
- Emotion-based animations

## Configuration
Default avatar: Shanee (female)
Default animation: unarmed-idle
Camera position: [0, 1.5, 1] looking at [0, 1.5, 0]
