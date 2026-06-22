import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Shared phone-screen chrome: a faux iOS status bar that flanks the dynamic island, then content. */
const ScreenShell = ({ children, className }: { children: ReactNode; className?: string }) => {
  return (
    <div className={cn('relative flex h-full w-full flex-col bg-slate-50 text-slate-900', className)}>
      {/* Dynamic island (sits in front of the screen content) */}
      <div
        className="pointer-events-none absolute left-1/2 top-[9px] z-20 flex h-[26px] w-[88px] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-2.5"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)' }}
        aria-hidden
      >
        <span
          className="h-[9px] w-[9px] rounded-full"
          style={{ background: 'radial-gradient(circle at 32% 30%, #33415f 0%, #0a0f1c 60%, #04060a 100%)' }}
        />
      </div>
      <div className="flex items-center justify-between px-5 pt-[15px] pb-1 text-[10px] font-bold tracking-tight">
        <span>9:41</span>
        <span className="flex items-center gap-[3px]">
          {/* signal */}
          <svg width="15" height="9" viewBox="0 0 15 9" fill="currentColor" aria-hidden>
            <rect x="0" y="6" width="2.4" height="3" rx="0.6" />
            <rect x="3.6" y="4" width="2.4" height="5" rx="0.6" />
            <rect x="7.2" y="2" width="2.4" height="7" rx="0.6" />
            <rect x="10.8" y="0" width="2.4" height="9" rx="0.6" />
          </svg>
          {/* wifi */}
          <svg width="13" height="9" viewBox="0 0 13 9" fill="currentColor" aria-hidden>
            <path d="M6.5 1.2c2 0 3.8.8 5.1 2l-1 1A5.7 5.7 0 0 0 6.5 2.7 5.7 5.7 0 0 0 2.4 4.2l-1-1a7.2 7.2 0 0 1 5.1-2Zm0 2.6c1.3 0 2.5.5 3.4 1.4l-1 1a3.4 3.4 0 0 0-4.8 0l-1-1A4.8 4.8 0 0 1 6.5 3.8Zm0 2.5c.6 0 1.2.3 1.6.7L6.5 9 4.9 7c.4-.4 1-.7 1.6-.7Z" />
          </svg>
          {/* battery */}
          <svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden>
            <rect x="0.5" y="0.5" width="16" height="9" rx="2.2" stroke="currentColor" opacity="0.45" />
            <rect x="2" y="2" width="11" height="6" rx="1.2" fill="currentColor" />
            <rect x="18" y="3" width="1.6" height="4" rx="0.8" fill="currentColor" opacity="0.45" />
          </svg>
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  )
}

export default ScreenShell
