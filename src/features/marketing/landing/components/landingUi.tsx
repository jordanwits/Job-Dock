import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/** Sentence-case kicker with a short rule. Used sparingly on spotlight sections (not every one). */
export const Kicker = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn('inline-flex items-center gap-2.5 text-sm font-semibold text-teal-600', className)}>
    <span className="h-px w-7 bg-teal-400" />
    {children}
  </span>
)

const iconPaths: Record<string, ReactNode> = {
  calendar: (
    <path
      d="M8 7V3m8 4V3M4 11h16M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  link: (
    <path
      d="M13.5 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.3-1.3M10.5 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.3 1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  camera: (
    <>
      <path
        d="M3 9a2 2 0 0 1 2-2h1.5l1-2h5l1 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  users: (
    <path
      d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1m13-9a3 3 0 1 0 0-6m-7 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm11 9v-1a4 4 0 0 0-3-3.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  chart: (
    <path
      d="M4 19V5m0 14h16M8 17v-5m4 5V9m4 8v-7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4 7 8 5 8-5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
}

export const FeatureIcon = ({ name, className }: { name: string; className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    aria-hidden
  >
    {iconPaths[name]}
  </svg>
)

const Arrow = () => (
  <svg
    className="ml-1.5 h-[1.05em] w-[1.05em] transition-transform duration-200 group-hover:translate-x-1"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    aria-hidden
  >
    <path d="M13 7l5 5m0 0l-5 5m5-5H6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

type ButtonVariant = 'primary' | 'ghost' | 'white' | 'dark'

interface LandingButtonProps {
  children: ReactNode
  to?: string
  onClick?: () => void
  variant?: ButtonVariant
  size?: 'md' | 'lg'
  className?: string
  withArrow?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-teal-500 text-white shadow-lg shadow-teal-500/30 hover:bg-teal-600 hover:shadow-teal-500/40',
  ghost: 'bg-white/70 text-slate-800 ring-1 ring-slate-200 backdrop-blur hover:bg-white',
  white: 'bg-white text-teal-700 shadow-lg shadow-slate-900/10 hover:bg-slate-50',
  dark: 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800',
}

/** Shared landing CTA. Renders a router Link when `to` is set, otherwise a button. */
export const LandingButton = ({
  children,
  to,
  onClick,
  variant = 'primary',
  size = 'md',
  className,
  withArrow = false,
}: LandingButtonProps) => {
  const classes = cn(
    'group inline-flex items-center justify-center rounded-full font-bold transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
    size === 'lg' ? 'px-7 py-3.5 text-[15px]' : 'px-5 py-2.5 text-sm',
    variantStyles[variant],
    className
  )

  const content = (
    <>
      {children}
      {withArrow && <Arrow />}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  )
}
