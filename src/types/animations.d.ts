declare module '@/assets/animations/Animations.json' {
  interface AnimationEntry {
    id: string
    name: string
    displayName: string
    category: string
    gender: 'masculine' | 'feminine'
    localPath: string
    remotePath: string
    duration: number
    loop: boolean
    weight: number
    blendTime: number
    priority: number
    tags: string[]
  }

  interface AnimationIndex {
    version: string
    description: string
    totalAnimations: number
    categories: string[]
    genders: string[]
    animations: {
      [gender: string]: {
        [category: string]: {
          [animationName: string]: AnimationEntry
        }
      }
    }
  }

  const value: AnimationIndex
  export default value
}