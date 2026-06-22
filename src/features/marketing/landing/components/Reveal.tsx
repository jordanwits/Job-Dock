import { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '../hooks/useReducedMotion'

type RevealDirection = 'up' | 'left' | 'right' | 'none'

interface RevealProps {
  children: ReactNode
  className?: string
  /** Entrance direction. */
  from?: RevealDirection
  /** Delay in ms for staggering siblings. */
  delay?: number
  /** Travel distance in px (default 28). */
  distance?: number
  style?: CSSProperties
}

/**
 * Lightweight entrance animation: fades + slides content into place the first time it enters
 * the viewport. Self-contained (inline transitions), and instantly visible under
 * `prefers-reduced-motion`.
 */
const Reveal = ({ children, className, from = 'up', delay = 0, distance = 28, style }: RevealProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(false)

  useEffect(() => {
    // Always-visible fallbacks: reduced motion, or environments without IntersectionObserver
    // (older browsers, some headless renderers) so content never ships hidden.
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [reduced])

  const hiddenTransform =
    from === 'up'
      ? `translate3d(0, ${distance}px, 0)`
      : from === 'left'
        ? `translate3d(-${distance}px, 0, 0)`
        : from === 'right'
          ? `translate3d(${distance}px, 0, 0)`
          : 'none'

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : hiddenTransform,
        transition: reduced
          ? undefined
          : `opacity 700ms ease ${delay}ms, transform 800ms cubic-bezier(0.16, 0.84, 0.44, 1) ${delay}ms`,
        willChange: shown ? undefined : 'opacity, transform',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export default Reveal
