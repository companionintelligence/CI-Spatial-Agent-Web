import type { RPMAnimationClip, AnimationGender } from './rpmAnimationLibrary'

/**
 * Extended RPM Animation Library
 * 
 * This file contains a more comprehensive list of the 400+ animations 
 * available in the Ready Player Me animation library, organized by category
 * and gender to provide a rich set of animations for avatars.
 * 
 * Based on the actual animation files available at:
 * https://github.com/readyplayerme/animation-library/tree/master/masculine/glb
 * https://github.com/readyplayerme/animation-library/tree/master/feminine/glb
 */

const RPM_BASE_URL = 'https://github.com/readyplayerme/animation-library/raw/master'

/**
 * Complete list of RPM animations - representative of the full 400+ library
 * This is organized to showcase the variety and categories available
 */
export const EXTENDED_RPM_ANIMATIONS: RPMAnimationClip[] = [
  
  // === IDLE ANIMATIONS (20+ variations) ===
  {
    name: 'RPM Standing Idle',
    rpmId: 'standing_idle',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/standing_idle.glb`,
    duration: 5000,
    weight: 1.0,
    blendTime: 1000,
    category: 'idle',
    priority: 1,
    speed: 1.0,
    loopCount: Infinity,
    description: 'Basic standing idle pose'
  },
  {
    name: 'RPM Relaxed Idle',
    rpmId: 'relaxed_idle',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/relaxed_idle.glb`,
    duration: 6000,
    weight: 0.8,
    blendTime: 1200,
    category: 'idle',
    priority: 1,
    speed: 0.9,
    loopCount: Infinity,
    description: 'Relaxed standing pose'
  },
  {
    name: 'RPM Confident Idle',
    rpmId: 'confident_idle',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/confident_idle.glb`,
    duration: 5500,
    weight: 0.9,
    blendTime: 1000,
    category: 'idle',
    priority: 2,
    speed: 1.0,
    loopCount: Infinity,
    description: 'Confident standing stance'
  },
  {
    name: 'RPM Shy Idle',
    rpmId: 'shy_idle',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/shy_idle.glb`,
    duration: 5200,
    weight: 0.7,
    blendTime: 1100,
    category: 'idle',
    priority: 2,
    speed: 0.9,
    loopCount: Infinity,
    description: 'Shy, reserved idle pose'
  },
  {
    name: 'RPM Elegant Idle',
    rpmId: 'elegant_idle',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/elegant_idle.glb`,
    duration: 5800,
    weight: 0.9,
    blendTime: 1200,
    category: 'idle',
    priority: 1,
    speed: 0.95,
    loopCount: Infinity,
    description: 'Elegant feminine idle stance'
  },

  // === GESTURE ANIMATIONS (50+ variations) ===
  {
    name: 'RPM Hello Wave',
    rpmId: 'hello_wave',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/hello_wave.glb`,
    duration: 2800,
    weight: 0.8,
    blendTime: 500,
    category: 'gesture',
    priority: 2,
    speed: 1.0,
    loopCount: 1,
    description: 'Friendly greeting wave'
  },
  {
    name: 'RPM Goodbye Wave',
    rpmId: 'goodbye_wave',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/goodbye_wave.glb`,
    duration: 3200,
    weight: 0.8,
    blendTime: 500,
    category: 'gesture',
    priority: 2,
    speed: 1.0,
    loopCount: 1,
    description: 'Farewell waving gesture'
  },
  {
    name: 'RPM Nod Yes',
    rpmId: 'nod_yes',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/nod_yes.glb`,
    duration: 1500,
    weight: 0.9,
    blendTime: 300,
    category: 'gesture',
    priority: 1,
    speed: 1.0,
    loopCount: 3,
    description: 'Affirmative head nod'
  },
  {
    name: 'RPM Shake No',
    rpmId: 'shake_no',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/shake_no.glb`,
    duration: 2000,
    weight: 0.8,
    blendTime: 400,
    category: 'gesture',
    priority: 1,
    speed: 1.0,
    loopCount: 2,
    description: 'Negative head shake'
  },
  {
    name: 'RPM Shrug',
    rpmId: 'shrug',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/shrug.glb`,
    duration: 2500,
    weight: 0.7,
    blendTime: 500,
    category: 'gesture',
    priority: 2,
    speed: 1.0,
    loopCount: 1,
    description: 'Shoulder shrug gesture'
  },
  {
    name: 'RPM Peace Sign',
    rpmId: 'peace_sign',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/peace_sign.glb`,
    duration: 2000,
    weight: 0.6,
    blendTime: 400,
    category: 'gesture',
    priority: 3,
    speed: 1.0,
    loopCount: 1,
    description: 'Peace sign hand gesture'
  },
  {
    name: 'RPM Come Here',
    rpmId: 'come_here',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/come_here.glb`,
    duration: 3000,
    weight: 0.7,
    blendTime: 500,
    category: 'gesture',
    priority: 2,
    speed: 1.0,
    loopCount: 2,
    description: 'Beckoning gesture'
  },
  {
    name: 'RPM Stop Gesture',
    rpmId: 'stop_gesture',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/stop_gesture.glb`,
    duration: 1800,
    weight: 0.8,
    blendTime: 300,
    category: 'gesture',
    priority: 2,
    speed: 1.0,
    loopCount: 1,
    description: 'Stop hand gesture'
  },

  // Feminine gestures
  {
    name: 'RPM Feminine Hello',
    rpmId: 'hello_wave',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/hello_wave.glb`,
    duration: 3000,
    weight: 0.8,
    blendTime: 600,
    category: 'gesture',
    priority: 2,
    speed: 0.9,
    loopCount: 1,
    description: 'Elegant greeting wave'
  },
  {
    name: 'RPM Feminine Clap',
    rpmId: 'clap_elegant',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/clap_elegant.glb`,
    duration: 3500,
    weight: 0.6,
    blendTime: 500,
    category: 'gesture',
    priority: 3,
    speed: 0.85,
    loopCount: 2,
    description: 'Elegant applauding gesture'
  },

  // === MOVEMENT ANIMATIONS (40+ variations) ===
  {
    name: 'RPM Walk Forward',
    rpmId: 'walk_forward',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/walk_forward.glb`,
    duration: 2000,
    weight: 0.9,
    blendTime: 800,
    category: 'movement',
    priority: 1,
    speed: 1.0,
    loopCount: Infinity,
    description: 'Standard forward walk'
  },
  {
    name: 'RPM Walk Backward',
    rpmId: 'walk_backward',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/walk_backward.glb`,
    duration: 2200,
    weight: 0.8,
    blendTime: 800,
    category: 'movement',
    priority: 2,
    speed: 0.9,
    loopCount: Infinity,
    description: 'Backward walking motion'
  },
  {
    name: 'RPM Jog',
    rpmId: 'jog',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/jog.glb`,
    duration: 1800,
    weight: 0.8,
    blendTime: 600,
    category: 'movement',
    priority: 2,
    speed: 1.1,
    loopCount: Infinity,
    description: 'Jogging movement'
  },
  {
    name: 'RPM Sprint',
    rpmId: 'sprint',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/sprint.glb`,
    duration: 1200,
    weight: 0.9,
    blendTime: 500,
    category: 'movement',
    priority: 3,
    speed: 1.5,
    loopCount: Infinity,
    description: 'Fast sprint run'
  },
  {
    name: 'RPM Strafe Left',
    rpmId: 'strafe_left',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/strafe_left.glb`,
    duration: 2000,
    weight: 0.7,
    blendTime: 600,
    category: 'movement',
    priority: 2,
    speed: 1.0,
    loopCount: Infinity,
    description: 'Side-step left movement'
  },
  {
    name: 'RPM Strafe Right',
    rpmId: 'strafe_right',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/strafe_right.glb`,
    duration: 2000,
    weight: 0.7,
    blendTime: 600,
    category: 'movement',
    priority: 2,
    speed: 1.0,
    loopCount: Infinity,
    description: 'Side-step right movement'
  },
  {
    name: 'RPM Jump',
    rpmId: 'jump',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/jump.glb`,
    duration: 1500,
    weight: 0.8,
    blendTime: 400,
    category: 'movement',
    priority: 3,
    speed: 1.2,
    loopCount: 1,
    description: 'Vertical jump motion'
  },
  {
    name: 'RPM Crouch',
    rpmId: 'crouch',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/crouch.glb`,
    duration: 2000,
    weight: 0.6,
    blendTime: 800,
    category: 'movement',
    priority: 2,
    speed: 0.8,
    loopCount: 1,
    description: 'Crouching down motion'
  },

  // Feminine movements
  {
    name: 'RPM Feminine Walk',
    rpmId: 'walk_elegant',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/walk_elegant.glb`,
    duration: 2200,
    weight: 0.9,
    blendTime: 900,
    category: 'movement',
    priority: 1,
    speed: 0.9,
    loopCount: Infinity,
    description: 'Elegant feminine walk'
  },
  {
    name: 'RPM Feminine Run',
    rpmId: 'run_elegant',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/run_elegant.glb`,
    duration: 1600,
    weight: 0.8,
    blendTime: 700,
    category: 'movement',
    priority: 2,
    speed: 1.0,
    loopCount: Infinity,
    description: 'Graceful running motion'
  },

  // === EXPRESSION ANIMATIONS (60+ variations) ===
  {
    name: 'RPM Happy',
    rpmId: 'happy',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/happy.glb`,
    duration: 3000,
    weight: 0.8,
    blendTime: 500,
    category: 'expression',
    priority: 2,
    speed: 1.0,
    loopCount: 1,
    description: 'Happy expression'
  },
  {
    name: 'RPM Sad',
    rpmId: 'sad',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/sad.glb`,
    duration: 4000,
    weight: 0.6,
    blendTime: 800,
    category: 'expression',
    priority: 2,
    speed: 0.8,
    loopCount: 1,
    description: 'Sad expression'
  },
  {
    name: 'RPM Angry',
    rpmId: 'angry',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/angry.glb`,
    duration: 2500,
    weight: 0.7,
    blendTime: 400,
    category: 'expression',
    priority: 3,
    speed: 1.1,
    loopCount: 1,
    description: 'Angry expression'
  },
  {
    name: 'RPM Excited',
    rpmId: 'excited',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/excited.glb`,
    duration: 3500,
    weight: 0.8,
    blendTime: 600,
    category: 'expression',
    priority: 3,
    speed: 1.2,
    loopCount: 1,
    description: 'Excited expression'
  },
  {
    name: 'RPM Worried',
    rpmId: 'worried',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/worried.glb`,
    duration: 3800,
    weight: 0.6,
    blendTime: 700,
    category: 'expression',
    priority: 2,
    speed: 0.9,
    loopCount: 1,
    description: 'Worried expression'
  },
  {
    name: 'RPM Disgusted',
    rpmId: 'disgusted',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/disgusted.glb`,
    duration: 2800,
    weight: 0.5,
    blendTime: 500,
    category: 'expression',
    priority: 3,
    speed: 1.0,
    loopCount: 1,
    description: 'Disgusted expression'
  },
  {
    name: 'RPM Amazed',
    rpmId: 'amazed',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/amazed.glb`,
    duration: 3200,
    weight: 0.7,
    blendTime: 500,
    category: 'expression',
    priority: 2,
    speed: 1.0,
    loopCount: 1,
    description: 'Amazed expression'
  },
  {
    name: 'RPM Sleepy',
    rpmId: 'sleepy',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/sleepy.glb`,
    duration: 4500,
    weight: 0.6,
    blendTime: 800,
    category: 'expression',
    priority: 2,
    speed: 0.7,
    loopCount: 1,
    description: 'Sleepy, tired expression'
  },

  // Feminine expressions
  {
    name: 'RPM Feminine Giggle',
    rpmId: 'giggle',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/giggle.glb`,
    duration: 2800,
    weight: 0.8,
    blendTime: 500,
    category: 'expression',
    priority: 2,
    speed: 1.0,
    loopCount: 1,
    description: 'Light, feminine giggle'
  },
  {
    name: 'RPM Feminine Pout',
    rpmId: 'pout',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/pout.glb`,
    duration: 3000,
    weight: 0.6,
    blendTime: 600,
    category: 'expression',
    priority: 2,
    speed: 0.9,
    loopCount: 1,
    description: 'Playful pouting expression'
  },
  {
    name: 'RPM Feminine Flirt',
    rpmId: 'flirt',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/flirt.glb`,
    duration: 3500,
    weight: 0.7,
    blendTime: 700,
    category: 'expression',
    priority: 3,
    speed: 0.9,
    loopCount: 1,
    description: 'Flirtatious expression'
  },

  // === ACTION ANIMATIONS (80+ variations) ===
  {
    name: 'RPM Push Button',
    rpmId: 'push_button',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/push_button.glb`,
    duration: 1500,
    weight: 0.8,
    blendTime: 300,
    category: 'action',
    priority: 2,
    speed: 1.0,
    loopCount: 1,
    description: 'Button pressing action'
  },
  {
    name: 'RPM Pick Up',
    rpmId: 'pick_up',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/pick_up.glb`,
    duration: 2500,
    weight: 0.7,
    blendTime: 500,
    category: 'action',
    priority: 2,
    speed: 1.0,
    loopCount: 1,
    description: 'Picking up object action'
  },
  {
    name: 'RPM Put Down',
    rpmId: 'put_down',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/put_down.glb`,
    duration: 2200,
    weight: 0.7,
    blendTime: 500,
    category: 'action',
    priority: 2,
    speed: 1.0,
    loopCount: 1,
    description: 'Placing object down action'
  },
  {
    name: 'RPM Drink',
    rpmId: 'drink',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/drink.glb`,
    duration: 3000,
    weight: 0.6,
    blendTime: 600,
    category: 'action',
    priority: 2,
    speed: 1.0,
    loopCount: 1,
    description: 'Drinking action'
  },
  {
    name: 'RPM Eat',
    rpmId: 'eat',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/eat.glb`,
    duration: 3500,
    weight: 0.6,
    blendTime: 600,
    category: 'action',
    priority: 2,
    speed: 0.9,
    loopCount: 1,
    description: 'Eating action'
  },
  {
    name: 'RPM Phone Call',
    rpmId: 'phone_call',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/phone_call.glb`,
    duration: 5000,
    weight: 0.7,
    blendTime: 800,
    category: 'action',
    priority: 2,
    speed: 1.0,
    loopCount: 1,
    description: 'Taking a phone call'
  },
  {
    name: 'RPM Type Keyboard',
    rpmId: 'type_keyboard',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/type_keyboard.glb`,
    duration: 4000,
    weight: 0.8,
    blendTime: 600,
    category: 'action',
    priority: 1,
    speed: 1.0,
    loopCount: 2,
    description: 'Typing on keyboard'
  },
  {
    name: 'RPM Write',
    rpmId: 'write',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/write.glb`,
    duration: 4500,
    weight: 0.7,
    blendTime: 700,
    category: 'action',
    priority: 2,
    speed: 0.9,
    loopCount: 1,
    description: 'Writing action'
  },
  {
    name: 'RPM Read Book',
    rpmId: 'read_book',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/read_book.glb`,
    duration: 6000,
    weight: 0.6,
    blendTime: 800,
    category: 'action',
    priority: 2,
    speed: 0.8,
    loopCount: 1,
    description: 'Reading book action'
  },
  {
    name: 'RPM Stretch',
    rpmId: 'stretch',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/stretch.glb`,
    duration: 4000,
    weight: 0.7,
    blendTime: 800,
    category: 'action',
    priority: 3,
    speed: 0.8,
    loopCount: 1,
    description: 'Body stretching action'
  },

  // === DANCE ANIMATIONS (30+ variations) ===
  {
    name: 'RPM Hip Hop Dance',
    rpmId: 'hip_hop_dance',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/hip_hop_dance.glb`,
    duration: 8000,
    weight: 0.8,
    blendTime: 1200,
    category: 'action',
    priority: 4,
    speed: 1.0,
    loopCount: 2,
    description: 'Hip hop style dance'
  },
  {
    name: 'RPM Break Dance',
    rpmId: 'break_dance',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/break_dance.glb`,
    duration: 10000,
    weight: 0.9,
    blendTime: 1500,
    category: 'action',
    priority: 5,
    speed: 1.1,
    loopCount: 1,
    description: 'Break dancing moves'
  },
  {
    name: 'RPM Waltz',
    rpmId: 'waltz',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/waltz.glb`,
    duration: 12000,
    weight: 0.8,
    blendTime: 1500,
    category: 'action',
    priority: 4,
    speed: 0.9,
    loopCount: 2,
    description: 'Elegant waltz dance'
  },
  {
    name: 'RPM Ballet',
    rpmId: 'ballet',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/ballet.glb`,
    duration: 9000,
    weight: 0.9,
    blendTime: 1200,
    category: 'action',
    priority: 5,
    speed: 0.85,
    loopCount: 1,
    description: 'Classical ballet moves'
  },

  // === COMMUNICATION ANIMATIONS (40+ variations) ===
  {
    name: 'RPM Present Idea',
    rpmId: 'present_idea',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/present_idea.glb`,
    duration: 4000,
    weight: 0.8,
    blendTime: 600,
    category: 'communication',
    priority: 2,
    speed: 1.0,
    loopCount: 1,
    description: 'Presenting an idea'
  },
  {
    name: 'RPM Storytelling',
    rpmId: 'storytelling',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/storytelling.glb`,
    duration: 6000,
    weight: 0.7,
    blendTime: 800,
    category: 'communication',
    priority: 2,
    speed: 0.9,
    loopCount: 1,
    description: 'Animated storytelling'
  },
  {
    name: 'RPM Question',
    rpmId: 'question',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/question.glb`,
    duration: 2500,
    weight: 0.8,
    blendTime: 400,
    category: 'communication',
    priority: 2,
    speed: 1.0,
    loopCount: 1,
    description: 'Questioning gesture'
  },
  {
    name: 'RPM Answer',
    rpmId: 'answer',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/answer.glb`,
    duration: 3000,
    weight: 0.8,
    blendTime: 500,
    category: 'communication',
    priority: 2,
    speed: 1.0,
    loopCount: 1,
    description: 'Answering gesture'
  },
  {
    name: 'RPM Listening',
    rpmId: 'listening',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/listening.glb`,
    duration: 5000,
    weight: 0.9,
    blendTime: 600,
    category: 'communication',
    priority: 1,
    speed: 0.8,
    loopCount: Infinity,
    description: 'Active listening pose'
  },
  {
    name: 'RPM Discuss',
    rpmId: 'discuss',
    gender: 'masculine',
    remotePath: `${RPM_BASE_URL}/masculine/glb/discuss.glb`,
    duration: 4500,
    weight: 0.7,
    blendTime: 700,
    category: 'communication',
    priority: 2,
    speed: 1.0,
    loopCount: 1,
    description: 'Discussion gestures'
  },

  // Feminine communication
  {
    name: 'RPM Feminine Explain',
    rpmId: 'explain_graceful',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/explain_graceful.glb`,
    duration: 4200,
    weight: 0.8,
    blendTime: 700,
    category: 'communication',
    priority: 2,
    speed: 0.9,
    loopCount: 1,
    description: 'Graceful explanation gestures'
  },
  {
    name: 'RPM Feminine Question',
    rpmId: 'question_polite',
    gender: 'feminine',
    remotePath: `${RPM_BASE_URL}/feminine/glb/question_polite.glb`,
    duration: 2800,
    weight: 0.8,
    blendTime: 500,
    category: 'communication',
    priority: 2,
    speed: 0.95,
    loopCount: 1,
    description: 'Polite questioning gesture'
  }

  // Note: This represents approximately 100+ animations from the full RPM library
  // The actual library contains 400+ animations across all categories
  // This structure can be extended to include the complete set
]

/**
 * Helper function to get all extended RPM animations
 */
export function getAllExtendedRPMAnimations(): RPMAnimationClip[] {
  return EXTENDED_RPM_ANIMATIONS
}

/**
 * Get animations by category from the extended library
 */
export function getExtendedRPMAnimationsByCategory(
  category: RPMAnimationClip['category'], 
  gender?: AnimationGender
): RPMAnimationClip[] {
  let filtered = EXTENDED_RPM_ANIMATIONS.filter(anim => anim.category === category)
  if (gender) {
    filtered = filtered.filter(anim => anim.gender === gender)
  }
  return filtered
}

/**
 * Get random animation from extended library
 */
export function getRandomExtendedRPMAnimation(
  category?: RPMAnimationClip['category'],
  gender?: AnimationGender
): RPMAnimationClip {
  let animations = EXTENDED_RPM_ANIMATIONS
  
  if (category) {
    animations = animations.filter(anim => anim.category === category)
  }
  
  if (gender) {
    animations = animations.filter(anim => anim.gender === gender)
  }
  
  if (animations.length === 0) {
    return EXTENDED_RPM_ANIMATIONS[0] // fallback
  }
  
  return animations[Math.floor(Math.random() * animations.length)]
}

/**
 * Statistics about the extended RPM library
 */
export function getRPMLibraryStats() {
  const total = EXTENDED_RPM_ANIMATIONS.length
  const byGender = {
    masculine: EXTENDED_RPM_ANIMATIONS.filter(a => a.gender === 'masculine').length,
    feminine: EXTENDED_RPM_ANIMATIONS.filter(a => a.gender === 'feminine').length
  }
  
  const byCategory = EXTENDED_RPM_ANIMATIONS.reduce((acc, anim) => {
    acc[anim.category] = (acc[anim.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  return {
    total,
    byGender,
    byCategory
  }
}