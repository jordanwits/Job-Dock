import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Html } from '@react-three/drei'
import * as THREE from 'three'
import { JOURNEY, SCREENS, STAGE_COUNT } from './phoneStages'

const MODEL_URL = '/marketing/landing/phone.glb'
useGLTF.preload(MODEL_URL)

const TURN = Math.PI * 2
const LERP = 0.1
// Overall on-screen size (model is ~1.912 tall in its own units → ~1.49 world here).
const SCALE = 0.78
// Front face of the model in its local Z, where the live screen overlay sits.
const FRONT_Z = 0.086
// Live screen DOM size + projection scale (tuned to fill the display).
const SCREEN_PX = { w: 300, h: 632 }
const SCREEN_DISTANCE_FACTOR = 1.16
// Set to Math.PI if the model's screen faces -Z instead of +Z.
const MODEL_YAW = 0

function smoothstep(t: number) {
  return t * t * (3 - 2 * t)
}

interface Sample {
  progress: number
  presence: number
  cx: number[]
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
  if (!cy.length) return { progress: 0, presence: 0, cx }

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
    if (rr.bottom < center) presence = Math.max(0, 1 - (center - rr.bottom) / (vh * 0.55))
    else if (rr.top > center) presence = Math.max(0, 1 - (rr.top - center) / (vh * 0.55))
  }
  return { progress, presence, cx }
}

export default function Phone3D() {
  const group = useRef<THREE.Group>(null)
  const screenWrap = useRef<HTMLDivElement>(null)
  const { camera, size } = useThree()

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
  const lastScreen = useRef(0)
  const rotY = useRef(0)
  const worldX = useRef(0)
  const pres = useRef(0)
  const inited = useRef(false)

  useFrame(state => {
    const g = group.current
    if (!g) return
    const { progress, presence, cx } = sampleScroll()

    const cam = camera as THREE.PerspectiveCamera
    const halfH = Math.tan((cam.fov * Math.PI) / 180 / 2) * cam.position.z
    const halfW = halfH * (size.width / size.height)
    const pxToWorld = (px: number) => ((px / size.width) * 2 - 1) * halfW

    const i = Math.floor(progress)
    const t = smoothstep(progress - i)
    const xa = cx[Math.min(i, cx.length - 1)] ?? size.width / 2
    const xb = cx[Math.min(i + 1, cx.length - 1)] ?? xa
    const targetX = pxToWorld(xa + (xb - xa) * t)
    const targetRot = progress * TURN

    if (!inited.current) {
      rotY.current = targetRot
      worldX.current = targetX
      inited.current = true
    }

    rotY.current += (targetRot - rotY.current) * LERP
    worldX.current += (targetX - worldX.current) * LERP
    pres.current += (presence - pres.current) * LERP

    const bob = Math.sin(state.clock.elapsedTime * 0.9) * 0.03
    g.position.set(worldX.current, bob, 0)
    g.rotation.set(-0.04, rotY.current, 0)
    g.scale.setScalar(Math.max(0.0001, pres.current) * SCALE)

    const idx = Math.round(progress)
    if (idx !== lastScreen.current && idx >= 0 && idx < STAGE_COUNT) {
      lastScreen.current = idx
      setScreenIndex(idx)
    }

    if (screenWrap.current) {
      const facing = Math.cos(rotY.current)
      const vis = facing > 0.25 ? Math.min(1, (facing - 0.25) / 0.45) : 0
      screenWrap.current.style.opacity = String(vis * Math.min(1, pres.current))
    }
  })

  const Screen = SCREENS[JOURNEY[screenIndex].screen]

  return (
    <group ref={group} scale={0.0001}>
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
