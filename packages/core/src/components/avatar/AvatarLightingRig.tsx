import type { JSX } from 'react'

export type AvatarLightingPreset = 'studio' | 'cyberpunk_violet' | 'cool_azure' | 'warm_amber' | 'clean_white' | 'none'

/**
 * Small R3F lighting presets for standalone avatar embeds and the harness.
 * The main app can continue to use its environment-aware scene rig.
 */
export function AvatarLightingRig({ preset = 'studio' }: { preset?: AvatarLightingPreset }): JSX.Element | null {
  if (preset === 'none') return null
  if (preset === 'cyberpunk_violet') {
    return (
      <>
        <ambientLight intensity={0.6} color="#a78bfa" />
        <pointLight position={[-3, 2, 2]} intensity={25} color="#8b5cf6" distance={8} />
        <pointLight position={[3, 1, -2]} intensity={20} color="#06b6d4" distance={8} />
        <directionalLight position={[0, 4, 3]} intensity={1.2} color="#d8b4fe" />
      </>
    )
  }
  if (preset === 'cool_azure') {
    return (
      <>
        <ambientLight intensity={0.7} color="#93c5fd" />
        <pointLight position={[-3, 2, 2]} intensity={22} color="#3b82f6" distance={8} />
        <pointLight position={[3, 1, -2]} intensity={16} color="#10b981" distance={8} />
        <directionalLight position={[0, 4, 3]} intensity={1.4} color="#e0f2fe" />
      </>
    )
  }
  if (preset === 'warm_amber') {
    return (
      <>
        <ambientLight intensity={0.8} color="#fde68a" />
        <pointLight position={[-3, 2, 2]} intensity={24} color="#f59e0b" distance={8} />
        <pointLight position={[3, 1, -2]} intensity={15} color="#ec4899" distance={8} />
        <directionalLight position={[0, 4, 3]} intensity={1.3} color="#fffbeb" />
      </>
    )
  }
  if (preset === 'clean_white') {
    return (
      <>
        <ambientLight intensity={1.1} color="#ffffff" />
        <directionalLight position={[2, 4, 5]} intensity={1.8} color="#ffffff" />
        <directionalLight position={[-2, -2, -2]} intensity={0.5} color="#f1f5f9" />
      </>
    )
  }
  return (
    <>
      <ambientLight intensity={0.75} color="#e2e8f0" />
      <pointLight position={[-3, 2, 2]} intensity={20} color="#60a5fa" distance={8} />
      <pointLight position={[3, 1, -2]} intensity={16} color="#34d399" distance={8} />
      <directionalLight position={[0, 4, 4]} intensity={1.5} color="#ffffff" />
    </>
  )
}
