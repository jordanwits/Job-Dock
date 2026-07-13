/**
 * Renders a real app screenshot full-bleed on the phone screen. The provided PNGs are full iPhone
 * captures (they already include the iOS status bar), so this draws no faux status bar — only the
 * dynamic-island pill that fills the physical notch gap the screenshot leaves empty. Used by every
 * screen in the phone journey, in both the 3D <Html> overlay and the static inline PhoneFrame.
 */
const PhoneScreenshot = ({ src, alt }: { src: string; alt: string }) => {
  return (
    <div className="relative h-full w-full bg-slate-50">
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover object-top"
        draggable={false}
      />
      {/* Dynamic island */}
      <div
        className="pointer-events-none absolute left-1/2 top-[9px] z-20 h-[26px] w-[88px] -translate-x-1/2 rounded-full bg-black"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)' }}
        aria-hidden
      />
    </div>
  )
}

export default PhoneScreenshot
