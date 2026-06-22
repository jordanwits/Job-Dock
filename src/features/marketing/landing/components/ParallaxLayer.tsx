import { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useParallax } from '../hooks/useParallax'

interface ParallaxLayerProps {
  children?: ReactNode
  className?: string
  style?: CSSProperties
  /** Drift multiplier relative to scroll. Negative values move against the scroll direction. */
  speed?: number
  axis?: 'y' | 'x'
  clamp?: number
  disableOnMobile?: boolean
  'aria-hidden'?: boolean
}

/** A positioned layer that drifts on scroll for depth. Purely decorative layers should set aria-hidden. */
const ParallaxLayer = ({
  children,
  className,
  style,
  speed = 0.18,
  axis = 'y',
  clamp,
  disableOnMobile = true,
  'aria-hidden': ariaHidden,
}: ParallaxLayerProps) => {
  const ref = useParallax<HTMLDivElement>({ speed, axis, clamp, disableOnMobile })
  return (
    <div ref={ref} className={cn(className)} style={style} aria-hidden={ariaHidden}>
      {children}
    </div>
  )
}

export default ParallaxLayer
