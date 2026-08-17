export type AvatarSizePreset = 'sm' | 'md' | 'lg' | number

export const AVATAR_SIZE_SCALES = {
  sm: 0.82,
  md: 1,
  lg: 1.18
} as const

export function resolveAvatarScale(size: AvatarSizePreset = 'md'): number {
  return typeof size === 'number' ? Math.max(0.1, size) : AVATAR_SIZE_SCALES[size]
}
