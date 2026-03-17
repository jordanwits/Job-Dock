import { ReactNode, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type RevealVariant = 'up' | 'left' | 'right' | 'fade'

interface ScrollRevealProps {
  children: ReactNode
  className?: string
  /** Animation direction: up, left, right, or fade-only */
  variant?: RevealVariant
  /** Optional delay in ms before animation runs (for stagger) */
  delay?: number
  /** Threshold 0-1 for how much of element must be visible (default 0.1) */
  threshold?: number
  /** Root margin - e.g. "50px" to trigger 50px before entering viewport */
  rootMargin?: string
}

const ScrollReveal = ({
  children,
  className,
  variant = 'up',
  delay = 0,
  threshold = 0.1,
  rootMargin = '0px 0px 60px 0px',
}: ScrollRevealProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setHasAnimated(true)
            if (delay > 0) {
              timeoutId = setTimeout(() => setIsVisible(true), delay)
            } else {
              setIsVisible(true)
            }
          }
        })
      },
      { threshold, rootMargin, root: null }
    )

    observer.observe(el)
    return () => {
      observer.disconnect()
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [threshold, rootMargin, delay])

  return (
    <div
      ref={ref}
      className={cn(
        'scroll-reveal',
        `scroll-reveal-${variant}`,
        isVisible && 'scroll-reveal-visible',
        className
      )}
    >
      {children}
    </div>
  )
}

export default ScrollReveal
