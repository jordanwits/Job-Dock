import { useEffect, useRef } from 'react'
import { subscribeToScroll } from './scrollEngine'
import { useReducedMotion } from './useReducedMotion'
import { useMediaQuery } from './useMediaQuery'

interface ParallaxOptions {
  /** Multiplier for how far the layer drifts relative to scroll. ~0.05–0.4 reads as depth. */
  speed?: number
  axis?: 'y' | 'x'
  /** Optional max pixel offset so layers never drift too far. */
  clamp?: number
  /** Disable the effect on small viewports (default true). */
  disableOnMobile?: boolean
}

/**
 * Returns a ref to attach to a DOM node. While the node is on screen and motion is allowed,
 * its `transform` is updated imperatively each frame to create a parallax drift. The applied
 * offset is backed out of the measurement every frame, so there is no feedback jitter and
 * resizes self-correct. Falls back to a static (untransformed) layer for reduced-motion / mobile.
 */
export function useParallax<T extends HTMLElement = HTMLDivElement>({
  speed = 0.18,
  axis = 'y',
  clamp,
  disableOnMobile = true,
}: ParallaxOptions = {}) {
  const ref = useRef<T>(null)
  const reduced = useReducedMotion()
  const isMobile = useMediaQuery('(max-width: 767px)')

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (reduced || (disableOnMobile && isMobile)) {
      el.style.transform = ''
      el.style.willChange = ''
      return
    }

    el.style.willChange = 'transform'
    let applied = 0

    const update = (scrollY: number, viewportH: number) => {
      const rect = el.getBoundingClientRect()
      // Element centre in document space, with the currently-applied transform removed.
      const center = rect.top + scrollY + rect.height / 2 - applied
      const viewportCenter = scrollY + viewportH / 2
      let offset = (viewportCenter - center) * speed
      if (clamp != null) offset = Math.max(-clamp, Math.min(clamp, offset))
      applied = offset
      el.style.transform =
        axis === 'y'
          ? `translate3d(0, ${offset.toFixed(2)}px, 0)`
          : `translate3d(${offset.toFixed(2)}px, 0, 0)`
    }

    const unsubscribe = subscribeToScroll(update)
    return () => {
      unsubscribe()
      el.style.willChange = ''
      el.style.transform = ''
    }
  }, [speed, axis, clamp, reduced, isMobile, disableOnMobile])

  return ref
}
