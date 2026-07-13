import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PhoneFrameProps {
  children?: ReactNode
  className?: string
  /** CSS width of the device. Height follows the iPhone-ish aspect ratio. */
  width?: string
  /**
   * SWAP SEAM — drop a real device asset in here later.
   * Provide a rendered PNG/WebP (a 3D mockup export) and it replaces the CSS screen content,
   * while the surrounding scroll float/tilt motion (PhoneShowcase) stays identical.
   * For a true 3D model (GLB), render it inside `children` instead (e.g. <model-viewer/>).
   */
  screenSrc?: string
  screenAlt?: string
}

/**
 * A premium CSS 3D phone shell: layered bezel, recessed glass screen, dynamic island and side
 * buttons. It is intentionally a placeholder for a real 3D mockup asset (see `screenSrc`).
 * The screen is a content slot, so any UI/photo can be shown inside the frame.
 */
const PhoneFrame = ({
  children,
  className,
  width = 'min(78vw, 300px)',
  screenSrc,
  screenAlt = '',
}: PhoneFrameProps) => {
  return (
    <div
      className={cn('relative select-none', className)}
      style={{ width, aspectRatio: '300 / 620' }}
    >
      {/* Bezel / casing */}
      <div
        className="absolute inset-0 rounded-[44px] p-[11px]"
        style={{
          background: 'linear-gradient(150deg, #4b5566 0%, #11141b 46%, #0a0c11 100%)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow:
            'inset 0 1px 1px rgba(255,255,255,0.35), inset 0 0 0 2px rgba(0,0,0,0.4), 0 36px 70px -28px rgba(8,18,46,0.55), 0 16px 34px -20px rgba(8,18,46,0.5)',
        }}
      >
        {/* Screen */}
        <div
          className="relative h-full w-full overflow-hidden rounded-[34px] bg-white"
          style={{ boxShadow: 'inset 0 0 0 2px rgba(2,6,23,0.55), inset 0 0 16px rgba(2,6,23,0.35)' }}
        >
          {screenSrc ? (
            <img
              src={screenSrc}
              alt={screenAlt}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            children
          )}

          {/* Glass glare */}
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden
            style={{
              background:
                'linear-gradient(125deg, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0.06) 26%, rgba(255,255,255,0) 42%)',
            }}
          />
        </div>

        {/* Dynamic island — only when showing a flat image; DOM screens draw their own. */}
        {screenSrc && (
          <div
            className="absolute left-1/2 top-[18px] h-[26px] w-[88px] -translate-x-1/2 rounded-full bg-black"
            aria-hidden
            style={{ boxShadow: 'inset 0 0 5px rgba(255,255,255,0.18)' }}
          />
        )}
      </div>

      {/* Side buttons */}
      <div className="absolute -left-[2px] top-[118px] h-[58px] w-[2px] rounded-l bg-slate-600/80" aria-hidden />
      <div className="absolute -right-[2px] top-[96px] h-[34px] w-[2px] rounded-r bg-slate-600/80" aria-hidden />
      <div className="absolute -right-[2px] top-[142px] h-[58px] w-[2px] rounded-r bg-slate-600/80" aria-hidden />
    </div>
  )
}

export default PhoneFrame
