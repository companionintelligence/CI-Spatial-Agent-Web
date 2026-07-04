import { useMemo, useState } from 'react'
import { RoundedBox, Text } from '@react-three/drei'
import { useXR } from '@react-three/xr'
import type { ThreeEvent } from '@react-three/fiber'

/**
 * In-world (spatial) XR control panel — SCAFFOLD.
 *
 * A flat DOM control bar (see `ControlPanel.tsx`) is awkward to reach once you
 * are inside an immersive session: it lives on the 2D overlay, not in the room
 * with you. This component renders the same primary actions as a spatial panel
 * built from plain react-three-fiber meshes + drei `<Text>`, so it works with
 * only the libraries already in the tree (no `@react-three/uikit` dependency).
 *
 * It is intentionally self-contained and side-effect free: it takes the same
 * action callbacks as the DOM bar and paints a row of tappable tiles. Buttons
 * respond to the standard fiber pointer events, which `@react-three/xr` maps to
 * controller rays / hand pinch automatically.
 *
 * ── How to mount (requires a change in Viewport3D/Scene3D, which are NOT in
 *    this task's file ownership) ────────────────────────────────────────────
 *   1. Thread the XR action handlers (enter/exit already live in ControlOverlay;
 *      recenter/scale live on `SceneActions`) down into `SceneContent`.
 *   2. Inside the `<XR store={store}>` subtree in `Scene3D.tsx`, render:
 *
 *        <XRControlPanel
 *          position={[0, 1.2, -1]}      // ~1m in front, at eye height
 *          onExitXR={...}
 *          onRecenter={sceneActions.recenter}
 *          onScaleUp={() => sceneActions.scaleBy(0.1)}
 *          onScaleDown={() => sceneActions.scaleBy(-0.1)}
 *          onToggleMic={...}
 *          micActive={config.microphone}
 *        />
 *
 *      `XRControlPanel` no-ops (returns null) when no immersive session is
 *      active, so it is safe to leave permanently mounted in the scene.
 *
 * TODO: mount in Viewport3D/Scene3D when in-session (see steps above).
 */

const PRIMARY = '#0f717a' // CI teal (canon --primary, light). Three.js needs a literal here.
const GLASS = '#04222f'
const FOREGROUND = '#e6f2f4'

export interface XRControlAction {
  key: string
  label: string
  onSelect: () => void
  active?: boolean
}

interface XRControlPanelProps {
  /** World position of the panel's centre, metres. Defaults to eye height, 1m ahead. */
  position?: [number, number, number]
  onToggleMic?: () => void
  micActive?: boolean
  onExitXR?: () => void
  onRecenter?: () => void
  onScaleUp?: () => void
  onScaleDown?: () => void
  /** Escape hatch: fully custom action set (overrides the derived one). */
  actions?: XRControlAction[]
}

/** A single tappable spatial tile: rounded slab + centred text glyph. */
function XRButton({
  action,
  x,
  size
}: {
  action: XRControlAction
  x: number
  size: number
}) {
  const [hovered, setHovered] = useState(false)
  const color = action.active ? PRIMARY : hovered ? '#0a5058' : GLASS

  const stop =
    (fn?: () => void) =>
    (e: ThreeEvent<PointerEvent | MouseEvent>) => {
      e.stopPropagation()
      fn?.()
    }

  return (
    <group position={[x, 0, 0]}>
      <RoundedBox
        args={[size, size, 0.02]}
        radius={0.02}
        smoothness={4}
        onClick={stop(action.onSelect)}
        onPointerOver={stop(() => setHovered(true))}
        onPointerOut={stop(() => setHovered(false))}
      >
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.92}
          roughness={0.35}
          metalness={0.05}
          emissive={action.active ? PRIMARY : '#000000'}
          emissiveIntensity={action.active ? 0.35 : 0}
        />
      </RoundedBox>
      <Text
        position={[0, 0, 0.012]}
        fontSize={size * 0.22}
        maxWidth={size * 0.9}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        color={FOREGROUND}
      >
        {action.label}
      </Text>
    </group>
  )
}

export function XRControlPanel({
  position = [0, 1.2, -1],
  onToggleMic,
  micActive = false,
  onExitXR,
  onRecenter,
  onScaleUp,
  onScaleDown,
  actions
}: XRControlPanelProps) {
  // Only meaningful inside an immersive session; render nothing otherwise so it
  // is safe to leave mounted permanently in the scene graph.
  const session = useXR((state) => state.session)

  const derived = useMemo<XRControlAction[]>(() => {
    const list: XRControlAction[] = []
    if (onToggleMic) list.push({ key: 'mic', label: micActive ? 'Mic on' : 'Mic', onSelect: onToggleMic, active: micActive })
    if (onRecenter) list.push({ key: 'recenter', label: 'Recenter', onSelect: onRecenter })
    if (onScaleDown) list.push({ key: 'scale-down', label: '–', onSelect: onScaleDown })
    if (onScaleUp) list.push({ key: 'scale-up', label: '+', onSelect: onScaleUp })
    if (onExitXR) list.push({ key: 'exit', label: 'Exit', onSelect: onExitXR })
    return list
  }, [onToggleMic, micActive, onRecenter, onScaleDown, onScaleUp, onExitXR])

  const items = actions ?? derived

  if (!session || items.length === 0) return null

  const tile = 0.16
  const gap = 0.04
  const step = tile + gap
  const totalWidth = items.length * tile + (items.length - 1) * gap
  const startX = -totalWidth / 2 + tile / 2

  const backdropPad = 0.05

  return (
    <group position={position}>
      {/* Frosted backdrop slab behind the row of tiles. */}
      <RoundedBox
        args={[totalWidth + backdropPad * 2, tile + backdropPad * 2, 0.01]}
        radius={0.03}
        smoothness={4}
        position={[0, 0, -0.015]}
      >
        <meshStandardMaterial color={GLASS} transparent opacity={0.55} roughness={0.5} />
      </RoundedBox>

      {items.map((action, i) => (
        <XRButton key={action.key} action={action} x={startX + i * step} size={tile} />
      ))}
    </group>
  )
}

export default XRControlPanel
