import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/* ── Icons (kept minimal — only for empty states / CTAs, never as header chips) ── */
type IconProps = { className?: string }
const Svg = ({ className, children }: { className?: string; children: ReactNode }) => (
  <svg
    className={cn('h-[18px] w-[18px]', className)}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
)
export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </Svg>
)
export const BriefcaseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </Svg>
)
export const DocumentIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </Svg>
)
export const ReceiptIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
  </Svg>
)
export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

/* ── Tones ──────────────────────────────────────────────────────────────── */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
export type ValueTone = 'ink' | 'accent' | 'success' | 'danger' | 'info' | 'warning'

const valueToneClass: Record<ValueTone, string> = {
  ink: 'text-ink',
  accent: 'text-accent-strong',
  success: 'text-success',
  danger: 'text-danger',
  info: 'text-info',
  warning: 'text-warning',
}

const dotClass: Record<Tone, string> = {
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-ink-subtle',
}

/** A small status dot — the routine, quiet status indicator. */
export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', dotClass[tone], className)} aria-hidden />
}

/** Filled pill — reserved for urgency only (overdue / declined), so saturated
 *  color still means something when it appears. */
export function StatusPill({ tone, children }: { tone: 'danger' | 'warning'; children: ReactNode }) {
  const cls = tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-danger-soft text-danger'
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', cls)}>
      {children}
    </span>
  )
}

/* ── Count-up (teaching motion on the hero metric) ─────────────────────────
   Animates 0 → target on mount; respects prefers-reduced-motion. */
function useCountUp(target: number, duration = 700): number {
  const prefersReduce =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [value, setValue] = useState<number>(() => (prefersReduce ? target : 0))
  const fromRef = useRef<number>(prefersReduce ? target : 0)

  useEffect(() => {
    if (prefersReduce || target === fromRef.current) {
      setValue(target)
      fromRef.current = target
      return
    }
    let raf = 0
    const from = fromRef.current
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(from + (target - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else {
        setValue(target)
        fromRef.current = target
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  return value
}

/* ── Hero metric — the single dominant number, bare on the canvas ────────── */
export function HeroMetric({
  label,
  amount,
  format,
  caption,
  tone = 'accent',
}: {
  label: string
  amount: number
  format: (n: number) => string
  caption?: ReactNode
  tone?: 'accent' | 'ink'
}) {
  const shown = useCountUp(amount)
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">{label}</p>
      <p
        className={cn(
          'mt-1.5 font-mono text-[3.1rem] font-semibold leading-none tracking-tight tabular-nums sm:text-[4rem]',
          tone === 'accent' ? 'text-accent-strong' : 'text-ink'
        )}
      >
        {format(shown)}
      </p>
      {caption && <div className="mt-3.5 text-[15px] leading-relaxed text-ink-muted">{caption}</div>}
    </div>
  )
}

/* ── Secondary KPI strip — bare, hairline-divided, no boxes/icons ────────── */
export function KpiStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-3 divide-x divide-line', className)}>{children}</div>
}

export function KpiItem({
  label,
  value,
  caption,
  to,
  index = 0,
}: {
  label: ReactNode
  value: ReactNode
  caption?: ReactNode
  to?: string
  index?: number
}) {
  const pad = index === 0 ? 'pr-4 sm:pr-5' : 'px-4 sm:px-5'
  const inner = (
    <>
      <p className="truncate text-[13px] text-ink-muted">{label}</p>
      <p className="mt-1.5 font-mono text-[1.6rem] font-semibold leading-none tabular-nums text-ink">{value}</p>
      {caption && <p className="mt-1.5 truncate text-xs text-ink-subtle">{caption}</p>}
    </>
  )
  if (to) {
    return (
      <Link
        to={to}
        className={cn(
          'block rounded-sm transition-opacity hover:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          pad
        )}
      >
        {inner}
      </Link>
    )
  }
  return <div className={pad}>{inner}</div>
}

/* ── Bare section header (sits on the canvas, above its content) ─────────── */
export function SectionHeader({
  title,
  viewAllHref,
  viewAllLabel = 'View all',
}: {
  title: string
  viewAllHref?: string
  viewAllLabel?: string
}) {
  return (
    <div className="mb-3.5 flex items-baseline justify-between gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
      {viewAllHref && (
        <Link
          to={viewAllHref}
          className="shrink-0 rounded text-[13px] font-medium text-accent-strong transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {viewAllLabel}
        </Link>
      )}
    </div>
  )
}

/* ── Panel — the one light container, used only for genuine object-lists ─── */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl bg-surface shadow-card', className)}>{children}</div>
}

/* ── Stat split — bare label/value pairs inside a panel, hairline-divided ── */
export function StatSplit({
  items,
}: {
  items: { value: ReactNode; label: string; tone?: ValueTone }[]
}) {
  return (
    <div className="flex divide-x divide-line">
      {items.map((it, i) => (
        <div
          key={i}
          className={cn('flex-1', i === 0 ? 'pr-4' : i === items.length - 1 ? 'pl-4' : 'px-4')}
        >
          <p className={cn('font-mono text-[1.55rem] font-semibold leading-none tabular-nums', valueToneClass[it.tone ?? 'ink'])}>
            {it.value}
          </p>
          <p className="mt-1.5 text-[13px] text-ink-muted">{it.label}</p>
        </div>
      ))}
    </div>
  )
}

/* ── Progress bar — fills on mount (teaching motion), reduced-motion safe ── */
export function ProgressBar({ value }: { value: number }) {
  const prefersReduce =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [width, setWidth] = useState(prefersReduce ? value : 0)
  useEffect(() => {
    if (prefersReduce) {
      setWidth(value)
      return
    }
    const id = requestAnimationFrame(() => setWidth(value))
    return () => cancelAnimationFrame(id)
  }, [value, prefersReduce])
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-line">
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

/* ── Empty state — calm, no decorative chip ────────────────────────────── */
export function EmptyState({
  icon,
  title,
  action,
}: {
  icon: ReactNode
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-9 text-center">
      <span className="text-ink-subtle">{icon}</span>
      <p className="max-w-[30ch] text-sm text-ink-muted">{title}</p>
      {action}
    </div>
  )
}
