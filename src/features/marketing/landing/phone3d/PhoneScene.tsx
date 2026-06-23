import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import Phone3D from './Phone3D'

/**
 * Fixed, transparent WebGL layer that holds the single traveling phone. Sits above section
 * backgrounds (z-30) but below the header (z-50), and never intercepts pointer events.
 * The render loop pauses when the phone region scrolls out of view.
 */
const PhoneScene = () => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const region = document.querySelector('[data-phone-region]')
    if (!region || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), {
      rootMargin: '15% 0px 15% 0px',
    })
    io.observe(region)
    return () => io.disconnect()
  }, [])

  return (
    <div
      className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-500"
      style={{ opacity: active ? 1 : 0 }}
      aria-hidden
    >
      <Canvas
        frameloop={active ? 'always' : 'never'}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5], fov: 30 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent', pointerEvents: 'none' }}
      >
        {/* No lights or environment: the phone uses unlit (MeshBasic) materials. */}
        <Suspense fallback={null}>
          <Phone3D />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default PhoneScene
