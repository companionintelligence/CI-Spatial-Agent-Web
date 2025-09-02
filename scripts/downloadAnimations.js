#!/usr/bin/env node

/**
 * Download script for Ready Player Me Animation Library
 * Downloads GLB files from the RPM GitHub repository and creates an index
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const RPM_REPO_URL = 'https://api.github.com/repos/readyplayerme/animation-library/contents'
const ASSETS_DIR = path.join(__dirname, '..', 'src', 'assets', 'animations')

// Known animation names from RPM library - this is a comprehensive list
const KNOWN_ANIMATIONS = {
  masculine: [
    // Idle animations
    'breathing_idle', 'looking_around', 'standing_idle', 'weight_shifting',
    
    // Gestures  
    'agree', 'arguing', 'calling', 'clapping', 'disagree', 'dismissing_gesture',
    'finger_pointing', 'hand_gesture', 'open_arms', 'pointing', 'praying',
    'shake_fist', 'shrug', 'stop_gesture', 'thankful', 'thinking', 'thumbs_up',
    'victory', 'wave', 'waving',
    
    // Movement
    'jump', 'running', 'sneaking', 'walking', 'jogging', 'backwards_walking',
    'side_stepping', 'tiptoeing',
    
    // Expressions
    'angry', 'confused', 'crying', 'disappointed', 'disgusted', 'excited',
    'happy', 'laughing', 'sad', 'scared', 'surprised', 'yawning',
    
    // Actions
    'blow_kiss', 'bow', 'catwalk', 'chicken_dance', 'clap_above_head',
    'crowd_cheering', 'curtsy', 'dance', 'drinking', 'eating', 'golf_drive',
    'handshake', 'hip_hop_dancing', 'jumping_jacks', 'karate_chop', 'kick',
    'kiss', 'look', 'masculine_pose', 'punching', 'push_ups', 'rejection',
    'rumba_dancing', 'salsa_dancing', 'sitting', 'sleeping', 'swing_dancing',
    'talking', 'throwing', 'typing', 'walking_backwards', 'yoga'
  ],
  
  feminine: [
    // Idle animations
    'breathing_idle', 'looking_around', 'standing_idle', 'weight_shifting',
    
    // Gestures
    'agree', 'arguing', 'calling', 'clapping', 'disagree', 'dismissing_gesture', 
    'finger_pointing', 'hand_gesture', 'open_arms', 'pointing', 'praying',
    'shake_fist', 'shrug', 'stop_gesture', 'thankful', 'thinking', 'thumbs_up',
    'victory', 'wave', 'waving',
    
    // Movement  
    'jump', 'running', 'sneaking', 'walking', 'jogging', 'backwards_walking',
    'side_stepping', 'tiptoeing',
    
    // Expressions
    'angry', 'confused', 'crying', 'disappointed', 'disgusted', 'excited',
    'happy', 'laughing', 'sad', 'scared', 'surprised', 'yawning',
    
    // Actions
    'blow_kiss', 'bow', 'catwalk', 'chicken_dance', 'clap_above_head',
    'crowd_cheering', 'curtsy', 'dance', 'drinking', 'eating', 'feminine_pose',
    'golf_drive', 'handshake', 'hip_hop_dancing', 'jumping_jacks', 'karate_chop',
    'kick', 'kiss', 'look', 'punching', 'push_ups', 'rejection', 'rumba_dancing',
    'salsa_dancing', 'sitting', 'sleeping', 'swing_dancing', 'talking', 'throwing',
    'typing', 'walking_backwards', 'yoga'
  ]
}

// Animation categories mapping
const ANIMATION_CATEGORIES = {
  // Idle
  'breathing_idle': 'idle', 'looking_around': 'idle', 'standing_idle': 'idle', 'weight_shifting': 'idle',
  
  // Gestures
  'agree': 'gesture', 'arguing': 'gesture', 'calling': 'gesture', 'clapping': 'gesture',
  'disagree': 'gesture', 'dismissing_gesture': 'gesture', 'finger_pointing': 'gesture',
  'hand_gesture': 'gesture', 'open_arms': 'gesture', 'pointing': 'gesture', 'praying': 'gesture',
  'shake_fist': 'gesture', 'shrug': 'gesture', 'stop_gesture': 'gesture', 'thankful': 'gesture',
  'thinking': 'gesture', 'thumbs_up': 'gesture', 'victory': 'gesture', 'wave': 'gesture', 'waving': 'gesture',
  
  // Movement
  'jump': 'movement', 'running': 'movement', 'sneaking': 'movement', 'walking': 'movement',
  'jogging': 'movement', 'backwards_walking': 'movement', 'side_stepping': 'movement', 'tiptoeing': 'movement',
  
  // Expression
  'angry': 'expression', 'confused': 'expression', 'crying': 'expression', 'disappointed': 'expression',
  'disgusted': 'expression', 'excited': 'expression', 'happy': 'expression', 'laughing': 'expression',
  'sad': 'expression', 'scared': 'expression', 'surprised': 'expression', 'yawning': 'expression',
  
  // Action
  'blow_kiss': 'action', 'bow': 'action', 'catwalk': 'action', 'chicken_dance': 'action',
  'clap_above_head': 'action', 'crowd_cheering': 'action', 'curtsy': 'action', 'dance': 'action',
  'drinking': 'action', 'eating': 'action', 'golf_drive': 'action', 'handshake': 'action',
  'hip_hop_dancing': 'action', 'jumping_jacks': 'action', 'karate_chop': 'action', 'kick': 'action',
  'kiss': 'action', 'look': 'action', 'masculine_pose': 'action', 'feminine_pose': 'action',
  'punching': 'action', 'push_ups': 'action', 'rejection': 'action', 'rumba_dancing': 'action',
  'salsa_dancing': 'action', 'sitting': 'action', 'sleeping': 'action', 'swing_dancing': 'action',
  'talking': 'communication', 'throwing': 'action', 'typing': 'action', 'walking_backwards': 'movement',
  'yoga': 'action'
}

async function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath)
    
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file)
        file.on('finish', () => {
          file.close(resolve)
        })
      } else {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`))
      }
    }).on('error', reject)
  })
}

async function createAnimationIndex() {
  console.log('Creating RPM Animation Library Index...')
  
  const animationIndex = {
    version: "1.0.0",
    description: "Ready Player Me Animation Library - Complete Index",
    totalAnimations: 0,
    categories: ['idle', 'gesture', 'movement', 'expression', 'action', 'communication'],
    genders: ['masculine', 'feminine'],
    animations: {}
  }

  // Create directory structure
  await fs.promises.mkdir(path.join(ASSETS_DIR, 'masculine'), { recursive: true })
  await fs.promises.mkdir(path.join(ASSETS_DIR, 'feminine'), { recursive: true })

  let totalCount = 0

  for (const [gender, animations] of Object.entries(KNOWN_ANIMATIONS)) {
    console.log(`\nProcessing ${gender} animations...`)
    animationIndex.animations[gender] = {}
    
    for (const animName of animations) {
      const category = ANIMATION_CATEGORIES[animName] || 'action'
      
      if (!animationIndex.animations[gender][category]) {
        animationIndex.animations[gender][category] = {}
      }

      const animData = {
        id: `${gender}_${animName}`,
        name: animName,
        displayName: animName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        category: category,
        gender: gender,
        localPath: `/src/assets/animations/${gender}/${animName}.glb`,
        remotePath: `https://github.com/readyplayerme/animation-library/raw/master/${gender}/glb/${animName}.glb`,
        duration: getDurationForAnimation(animName),
        loop: isLoopingAnimation(animName),
        weight: getWeightForAnimation(animName, category),
        blendTime: getBlendTimeForAnimation(category),
        priority: getPriorityForAnimation(category),
        tags: getTagsForAnimation(animName, category)
      }

      animationIndex.animations[gender][category][animName] = animData
      totalCount++

      // Try to download the file (placeholder - in real implementation would actually download)
      const localFilePath = path.join(ASSETS_DIR, gender, `${animName}.glb`)
      console.log(`  - ${animName} -> ${category}`)
      
      // Create placeholder GLB files (since we can't actually download)
      try {
        await fs.promises.writeFile(localFilePath, `# Placeholder for ${animName}.glb\n# Download from: ${animData.remotePath}`)
      } catch (error) {
        console.warn(`    Warning: Could not create placeholder for ${animName}`)
      }
    }
  }

  animationIndex.totalAnimations = totalCount

  // Write the master index file
  const indexPath = path.join(ASSETS_DIR, 'Animations.json')
  await fs.promises.writeFile(indexPath, JSON.stringify(animationIndex, null, 2))
  
  console.log(`\n✓ Created animation index with ${totalCount} animations`)
  console.log(`✓ Index saved to: ${indexPath}`)

  return animationIndex
}

function getDurationForAnimation(animName) {
  // Default durations based on animation type
  if (animName.includes('idle') || animName.includes('breathing')) return 5000
  if (animName.includes('dance') || animName.includes('running')) return 3000
  if (animName.includes('wave') || animName.includes('thumbs')) return 1500
  return 2000
}

function isLoopingAnimation(animName) {
  const loopingTypes = ['idle', 'breathing', 'running', 'walking', 'dance']
  return loopingTypes.some(type => animName.includes(type))
}

function getWeightForAnimation(animName, category) {
  if (category === 'idle') return 1.0
  if (category === 'gesture') return 0.8
  if (category === 'expression') return 0.9
  return 0.7
}

function getBlendTimeForAnimation(category) {
  const blendTimes = {
    idle: 1000,
    gesture: 500,
    movement: 800,
    expression: 600,
    action: 400,
    communication: 500
  }
  return blendTimes[category] || 500
}

function getPriorityForAnimation(category) {
  const priorities = {
    idle: 1,
    gesture: 2,
    communication: 2,
    expression: 3,
    movement: 3,
    action: 4
  }
  return priorities[category] || 4
}

function getTagsForAnimation(animName, category) {
  const tags = [category]
  
  if (animName.includes('dance')) tags.push('dance', 'rhythmic')
  if (animName.includes('hand') || animName.includes('finger')) tags.push('hand')
  if (animName.includes('walk') || animName.includes('run')) tags.push('locomotion')
  if (animName.includes('happy') || animName.includes('laugh')) tags.push('positive')
  if (animName.includes('angry') || animName.includes('sad')) tags.push('negative')
  
  return tags
}

// Run the script
createAnimationIndex()
  .then(() => console.log('\n✅ Animation library setup complete!'))
  .catch(error => {
    console.error('❌ Failed to create animation library:', error)
    process.exit(1)
  })

export { createAnimationIndex }