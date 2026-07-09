import { useMemo, useRef, useState, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Html } from '@react-three/drei'
import * as THREE from 'three'
import { JOURNEY, SCREENS, STAGE_COUNT } from './phoneStages'

const MODEL_URL = '/marketing/landing/phone.glb'
useGLTF.preload(MODEL_URL)

const TURN = Math.PI * 2
// Lerp toward the (discrete) target stage. Lower = slower, more deliberate flip-and-travel.
const FLIP_LERP = 0.045
// Fade-in of the phone as its region approaches; kept snappier than the flip.
const PRES_LERP = 0.1
// Overall on-screen size (model is ~1.912 tall in its own units → ~1.49 world here).
const SCALE = 0.78
// Front face of the model in its local Z, where the live screen overlay sits.
const FRONT_Z = 0.086
// Live screen DOM size + projection scale (tuned to fill the display).
const SCREEN_PX = { w: 300, h: 632 }
const SCREEN_DISTANCE_FACTOR = 1.16
// Set to Math.PI if the model's screen faces -Z instead of +Z.
const MODEL_YAW = 0

interface Sample {
  progress: number
  presence: number
  cx: number[]
  cy: number[]
}

function sampleScroll(): Sample {
  const marks = document.querySelectorAll<HTMLElement>('[data-phone-stage]')
  const region = document.querySelector<HTMLElement>('[data-phone-region]')
  const vh = window.innerHeight
  const center = vh / 2
  const cy: number[] = []
  const cx: number[] = []
  marks.forEach(el => {
    const r = el.getBoundingClientRect()
    cy.push(r.top + r.height / 2)
    cx.push(r.left + r.width / 2)
  })
  if (!cy.length) return { progress: 0, presence: 0, cx, cy }

  let i = 0
  for (let k = 0; k < cy.length; k++) {
    if (cy[k] <= center) i = k
  }
  let progress = i
  if (i < cy.length - 1) {
    const span = cy[i + 1] - cy[i]
    progress = i + (span > 0 ? Math.max(0, Math.min(1, (center - cy[i]) / span)) : 0)
  }

  let presence = 1
  if (region) {
    const rr = region.getBoundingClientRect()
    // Fade in as the region approaches from below. No fade-out at the bottom: once the phone
    // reaches the final (reports) stage it stays full-size and centred until the user scrolls
    // back up; the fixed canvas itself fades out (IntersectionObserver) past the region.
    if (rr.top > center) presence = Math.max(0, 1 - (rr.top - center) / (vh * 0.55))
  }
  return { progress, presence, cx, cy }
}

/**
 * Drives the phone group's transform every frame. Rendered as the FIRST child of the group so its
 * useFrame subscribes before the drei <Html> overlay's does (React fires earlier siblings' effects
 * first). That order is load-bearing: <Html transform> reads the group's world matrix in its own
 * useFrame, so if we moved the group AFTER it ran, the CSS screen overlay would trail the WebGL
 * mesh by one frame and visibly shift while scrolling. Running first locks the overlay to the model.
 */
function PhoneRig({
  groupRef,
  screenWrapRef,
  onScreen,
}: {
  groupRef: RefObject<THREE.Group>
  screenWrapRef: RefObject<HTMLDivElement>
  onScreen: (index: number) => void
}) {
  const { camera, size } = useThree()
  const activeStage = useRef(0)
  const lastScreen = useRef(0)
  const rotY = useRef(0)
  const worldX = useRef(0)
  // Eased vertical carry-over: on a stage change we seed this with the gap between the old and
  // new section centres, then decay it to 0 so the phone glides from one section to the next
  // instead of jumping. Between stage changes it's ~0, so the phone stays docked to its section.
  const yOffset = useRef(0)
  const pres = useRef(0)
  const inited = useRef(false)

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    const { progress, presence, cx, cy } = sampleScroll()

    const cam = camera as THREE.PerspectiveCamera
    const halfH = Math.tan((cam.fov * Math.PI) / 180 / 2) * cam.position.z
    const halfW = halfH * (size.width / size.height)
    const pxToWorld = (px: number) => ((px / size.width) * 2 - 1) * halfW
    // Viewport pixel Y (0 = top) → world Y (top = +halfH). Full viewport height = 2·halfH.
    const pyToWorld = (py: number) => (1 - (py / size.height) * 2) * halfH
    const clampIdx = (i: number) => Math.max(0, Math.min(cx.length - 1, i))

    // Threshold-triggered stage advance. Rather than scrubbing rotation/position directly off
    // the continuous scroll (which makes the phone spin freely with the wheel), we snap to a
    // discrete "active" stage once scroll crosses past its midpoint, then let the lerp below
    // carry out the full flip-and-travel to that stage as one self-driven motion. The 0.6
    // deadband (vs. a bare 0.5 midpoint) adds hysteresis so hovering near a boundary can't make
    // the phone flip-flop back and forth.
    const maxStage = STAGE_COUNT - 1
    const prevStage = activeStage.current
    if (Math.abs(progress - activeStage.current) > 0.6) {
      activeStage.current = Math.max(0, Math.min(maxStage, Math.round(progress)))
    }
    // When the stage changes, preserve the phone's current vertical spot by carrying the
    // old→new section-centre gap into the offset; it then eases to 0, animating the travel.
    if (activeStage.current !== prevStage && cy.length) {
      yOffset.current +=
        pyToWorld(cy[clampIdx(prevStage)]) - pyToWorld(cy[clampIdx(activeStage.current)])
    }

    const targetX = pxToWorld(cx[clampIdx(activeStage.current)] ?? size.width / 2)
    // Dock to the active section's text centre (its stage marker) so the phone stays put beside
    // the copy as you scroll, instead of floating at a fixed viewport point the text slides past.
    const targetY = cy.length ? pyToWorld(cy[clampIdx(activeStage.current)]) : 0
    const targetRot = activeStage.current * TURN

    if (!inited.current) {
      rotY.current = targetRot
      worldX.current = targetX
      inited.current = true
    }

    rotY.current += (targetRot - rotY.current) * FLIP_LERP
    worldX.current += (targetX - worldX.current) * FLIP_LERP
    yOffset.current += (0 - yOffset.current) * FLIP_LERP
    pres.current += (presence - pres.current) * PRES_LERP

    g.position.set(worldX.current, targetY + yOffset.current, 0)
    g.rotation.set(-0.04, rotY.current, 0)
    g.scale.setScalar(Math.max(0.0001, pres.current) * SCALE)

    // Swap the screen mid-flip: a stage change always drives a full turn, so wait until the
    // phone is turned away from the camera (facing < 0, overlay already faded out) to switch,
    // keeping the swap hidden.
    const facing = Math.cos(rotY.current)
    if (activeStage.current !== lastScreen.current && facing < 0) {
      lastScreen.current = activeStage.current
      onScreen(activeStage.current)
    }

    if (screenWrapRef.current) {
      const vis = facing > 0.25 ? Math.min(1, (facing - 0.25) / 0.45) : 0
      screenWrapRef.current.style.opacity = String(vis * Math.min(1, pres.current))
    }
  })

  return null
}

export default function Phone3D() {
  const group = useRef<THREE.Group>(null)
  const screenWrap = useRef<HTMLDivElement>(null)

  const { scene } = useGLTF(MODEL_URL)
  const model = useMemo(() => {
    const clone = scene.clone(true)
    // Render the model UNLIT: swap its PBR materials for MeshBasicMaterial so it shows the baked
    // base-color texture flat, with no scene lights, shading, or environment reflections.
    const toUnlit = (orig: THREE.Material) => {
      const std = orig as THREE.MeshStandardMaterial
      const basic = new THREE.MeshBasicMaterial({
        map: std.map ?? null,
        color: std.color ? std.color.clone() : new THREE.Color(0xffffff),
        transparent: std.transparent,
        opacity: std.opacity,
        alphaTest: std.alphaTest,
        side: std.side,
      })
      basic.toneMapped = false
      return basic
    }
    clone.traverse(o => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = false
      mesh.receiveShadow = false
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(toUnlit)
        : toUnlit(mesh.material)
    })
    return clone
  }, [scene])

  const [screenIndex, setScreenIndex] = useState(0)

  const Screen = SCREENS[JOURNEY[screenIndex].screen]

  return (
    <group ref={group} scale={0.0001}>
      {/* Transform driver — must be the first child so it runs before the <Html> overlay's frame. */}
      <PhoneRig groupRef={group} screenWrapRef={screenWrap} onScreen={setScreenIndex} />

      {/* Real device model (provided GLB) */}
      <primitive object={model} rotation={[0, MODEL_YAW, 0]} />

      {/* Live app screen overlaid on the front face */}
      <Html
        transform
        position={[0, 0, FRONT_Z]}
        distanceFactor={SCREEN_DISTANCE_FACTOR}
        zIndexRange={[20, 0]}
        pointerEvents="none"
      >
        <div
          ref={screenWrap}
          style={{
            width: SCREEN_PX.w,
            height: SCREEN_PX.h,
            borderRadius: 34,
            overflow: 'hidden',
            position: 'relative',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <Screen />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'linear-gradient(125deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.05) 22%, rgba(255,255,255,0) 42%)',
            }}
          />
        </div>
      </Html>
    </group>
  )
}
