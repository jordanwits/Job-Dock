import {
  ButtonHTMLAttributes,
  ReactNode,
  forwardRef,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { cn } from '@/lib/utils'

/**
 * Reports UI primitives — token-driven.
 *
 * Mirrors the dashboard / scheduling / quotes / jobs / invoices design language
 * (canvas / surface / ink / line / accent, mono numbers, bare-vs-contained,
 * soft-shadow panels). Reads only the semantic CSS-variable tokens so it follows
 * the app's light/dark toggle, and deliberately does NOT use the shared
 * `components/ui` controls (still navy/gold) — the same self-contained pattern as
 * `schedulingUi.tsx` / `invoicesUi.tsx` / `quotesUi.tsx`.
 */

/* ── Tones ────────────────────────────────────────────────────────────── */
export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
export type ValueTone = 'ink' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

const valueToneCls: Record<ValueTone, string> = {
  ink: 'text-ink',
  accent: 'text-accent-strong',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  muted: 'text-ink-muted',
}

const softPillCls: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent-strong',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  neutral: 'bg-surface-2 text-ink-muted',
}

const dotCls: Record<Tone, string> = {
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-ink-subtle',
}

/* ── Icons ────────────────────────────────────────────────────────────── */
type IconProps = { className?: string }
const Svg = ({ className, children, strokeWidth = 1.75 }: { className?: string; children: ReactNode; strokeWidth?: number }) => (
  <svg
    className={cn('h-[18px] w-[18px]', className)}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
)
export const ChevronDownIcon = (p: IconProps) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>
export const ChevronLeftIcon = (p: IconProps) => <Svg {...p}><path d="M15 18l-6-6 6-6" /></Svg>
export const ChevronRightIcon = (p: IconProps) => <Svg {...p}><path d="M9 18l6-6-6-6" /></Svg>
export const CalendarIcon = (p: IconProps) => <Svg {...p}><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></Svg>
export const DocumentIcon = (p: IconProps) => <Svg {...p}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></Svg>
export const ReceiptIcon = (p: IconProps) => <Svg {...p}><path d="M4 3h16v18l-3-2-3 2-3-2-3 2V3z" /><path d="M8 8h8M8 12h8" /></Svg>
export const BriefcaseIcon = (p: IconProps) => <Svg {...p}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></Svg>
export const UsersIcon = (p: IconProps) => <Svg {...p}><path d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 00-3-6.5" /></Svg>
export const DownloadIcon = (p: IconProps) => <Svg {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></Svg>

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4 animate-spin', className)} fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

/* ── Button ───────────────────────────────────────────────────────────── */
type ButtonVariant = 'primary' | 'subtle' | 'ghost'
export interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent-strong text-accent-contrast hover:opacity-90',
  subtle: 'bg-surface text-ink ring-1 ring-inset ring-line hover:bg-surface-hover',
  ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
}

export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, children, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-[opacity,background-color,color] ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ' +
      'disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap'
    const sizes = { sm: 'h-9 px-3 text-[13px]', md: 'h-10 px-4 text-sm' }
    return (
      <button ref={ref} className={cn(base, sizes[size], buttonVariants[variant], className)} disabled={disabled} {...props}>
        {children}
      </button>
    )
  }
)
AppButton.displayName = 'AppButton'

/* ── Panel — the one contained surface ────────────────────────────────── */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl bg-surface shadow-card', className)}>{children}</div>
}

/* ── Section header (bare, on canvas) ─────────────────────────────────── */
export function SectionHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
      {action}
    </div>
  )
}

/* ── Stat grid / tile — bare numbers, no inner boxes ──────────────────── */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4', className)}>{children}</div>
}

export function StatTile({
  label,
  value,
  sub,
  tone = 'ink',
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: ValueTone
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">{label}</p>
      <p className={cn('mt-2 break-words font-mono text-[1.6rem] font-semibold leading-none tabular-nums', valueToneCls[tone])}>
        {value}
      </p>
      {sub != null && sub !== '' && <p className="mt-1.5 break-words text-[13px] text-ink-muted">{sub}</p>}
    </div>
  )
}

/* ── Status badge + dot ───────────────────────────────────────────────── */
export function StatusBadge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize',
        softPillCls[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', dotCls[tone], className)} aria-hidden />
}

/* ── Breakdown row — status pill + count + amount ─────────────────────── */
export function BreakdownRow({
  tone,
  label,
  count,
  amount,
  sub,
}: {
  tone: Tone
  label: string
  count: ReactNode
  amount?: ReactNode
  sub?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <StatusBadge tone={tone}>{label}</StatusBadge>
        <span className="truncate text-[13px] text-ink-muted">{count}</span>
      </div>
      {(amount != null || sub != null) && (
        <div className="shrink-0 text-right">
          {amount != null && (
            <span className="block font-mono text-sm font-medium tabular-nums text-ink">{amount}</span>
          )}
          {sub != null && <span className="block text-xs text-ink-subtle">{sub}</span>}
        </div>
      )}
    </div>
  )
}

/** Small uppercase label that introduces a details group. */
export function DetailLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">{children}</p>
}

/* ── Avatar ───────────────────────────────────────────────────────────── */
export function Avatar({ name, size = 'md' }: { name?: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = (name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p.charAt(0))
    .join('')
    .toUpperCase()
  const sizes = {
    sm: 'h-9 w-9 text-[13px]',
    md: 'h-11 w-11 text-sm',
    lg: 'h-14 w-14 text-lg',
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-strong',
        sizes[size]
      )}
      aria-hidden
    >
      {initials || '?'}
    </span>
  )
}

/* ── Empty state ──────────────────────────────────────────────────────── */
export function EmptyState({ icon, title }: { icon?: ReactNode; title: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      {icon && <span className="text-ink-subtle">{icon}</span>}
      <p className="max-w-[36ch] text-sm text-ink-muted">{title}</p>
    </div>
  )
}

/* ── Report section — the standard report card ────────────────────────── */
export function ReportSection({
  title,
  onExport,
  exportDisabled,
  empty,
  emptyIcon,
  emptyText,
  defaultOpen = false,
  details,
  children,
}: {
  title: ReactNode
  onExport: () => void
  exportDisabled?: boolean
  empty?: boolean
  emptyIcon?: ReactNode
  emptyText?: ReactNode
  defaultOpen?: boolean
  details?: ReactNode
  children?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section>
      <SectionHeader
        title={title}
        action={
          <AppButton variant="subtle" size="sm" onClick={onExport} disabled={exportDisabled}>
            <DownloadIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </AppButton>
        }
      />
      <Panel className="p-5 sm:p-6">
        {empty ? (
          <EmptyState icon={emptyIcon} title={emptyText} />
        ) : (
          <>
            {children}
            {details && (
              <div className="mt-5 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => setOpen(o => !o)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-2 rounded-sm py-1 text-left text-[13px] font-medium text-accent-strong transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span>{open ? 'Hide details' : 'Show details'}</span>
                  <ChevronDownIcon className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
                </button>
                {open && <div className="mt-4">{details}</div>}
              </div>
            )}
          </>
        )}
      </Panel>
    </section>
  )
}

/* ── Field shells (for the date-range control) ────────────────────────── */
const labelCls = 'mb-1.5 block text-sm font-medium text-ink'

/* ── Select (token-styled) ────────────────────────────────────────────── */
export interface SelectFieldProps {
  label?: string
  options: Array<{ value: string; label: string }>
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function SelectField({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  disabled,
  className,
}: SelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    if (isOpen) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [isOpen])

  const selected = options.find(o => o.value === value)

  return (
    <div className={cn('w-full', className)}>
      {label && <label className={labelCls}>{label}</label>}
      <div className="relative w-full" ref={containerRef}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(o => !o)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-sm outline-none transition-[border-color,box-shadow]',
            'focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]',
            'disabled:cursor-not-allowed disabled:opacity-60',
            isOpen && 'border-accent shadow-[0_0_0_3px_var(--accent-soft)]',
            selected ? 'text-ink' : 'text-ink-subtle'
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronDownIcon className={cn('h-4 w-4 shrink-0 text-ink-subtle transition-transform', isOpen && 'rotate-180')} />
        </button>

        {isOpen && (
          <div
            role="listbox"
            className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-xl bg-surface p-1.5 shadow-pop ring-1 ring-line"
          >
            {options.map(o => {
              const isSel = value === o.value
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onClick={() => {
                    onChange?.(o.value)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    isSel ? 'bg-accent-soft font-medium text-accent-strong' : 'text-ink hover:bg-surface-2'
                  )}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Date field (token calendar popover) ──────────────────────────────── */
const parseDateStringAsLocal = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export interface DateFieldProps {
  value?: string
  onChange?: (date: string) => void
  label?: string
  placeholder?: string
  disabled?: boolean
  minDate?: string
  maxDate?: string
  className?: string
}

export function DateField({
  value,
  onChange,
  label,
  placeholder = 'Select a date',
  disabled = false,
  minDate,
  maxDate,
  className,
}: DateFieldProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(value ? parseDateStringAsLocal(value) : new Date())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    if (isOpen) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [isOpen])

  const selectedDate = value ? parseDateStringAsLocal(value) : null
  const min = minDate ? parseDateStringAsLocal(minDate) : null
  const max = maxDate ? parseDateStringAsLocal(maxDate) : null

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) })

  const isDateDisabled = (date: Date) => Boolean((min && date < min) || (max && date > max))

  const handleDateSelect = (date: Date) => {
    if (isDateDisabled(date)) return
    onChange?.(format(date, 'yyyy-MM-dd'))
    setIsOpen(false)
  }

  const formatDisplayDate = (dateString?: string) => {
    if (!dateString) return ''
    try {
      return format(parseDateStringAsLocal(dateString), 'MMM dd, yyyy')
    } catch {
      return dateString
    }
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className={cn('w-full', className)} ref={containerRef}>
      {label && <label className={labelCls}>{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(o => !o)}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-sm outline-none transition-[border-color,box-shadow]',
            'focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]',
            'disabled:cursor-not-allowed disabled:opacity-60',
            isOpen && 'border-accent shadow-[0_0_0_3px_var(--accent-soft)]'
          )}
        >
          <span className={cn('flex-1 truncate', value ? 'text-ink' : 'text-ink-subtle')}>
            {value ? formatDisplayDate(value) : placeholder}
          </span>
          <CalendarIcon className="h-4 w-4 shrink-0 text-ink-subtle" />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-2 w-full min-w-[280px] rounded-xl bg-surface p-4 shadow-pop ring-1 ring-line">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                aria-label="Previous month"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <h3 className="text-sm font-semibold text-ink">{format(currentMonth, 'MMMM yyyy')}</h3>
              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                aria-label="Next month"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1">
              {weekDays.map(day => (
                <div key={day} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isSelected = selectedDate && isSameDay(day, selectedDate)
                const isTodayDate = isToday(day)
                const disabledDay = isDateDisabled(day)
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleDateSelect(day)}
                    disabled={disabledDay || !isCurrentMonth}
                    className={cn(
                      'h-9 w-9 rounded-lg font-mono text-sm tabular-nums transition-colors',
                      !isCurrentMonth && 'text-ink-subtle/40',
                      isCurrentMonth && !isSelected && !isTodayDate && 'text-ink hover:bg-surface-2',
                      isTodayDate && !isSelected && 'bg-surface-2 font-semibold text-ink',
                      isSelected && 'bg-accent-strong font-semibold text-accent-contrast hover:opacity-90',
                      disabledDay && 'cursor-not-allowed opacity-30 hover:bg-transparent'
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 border-t border-line pt-3">
              <button
                type="button"
                onClick={() => handleDateSelect(new Date())}
                className="w-full rounded-lg px-4 py-2 text-sm font-medium text-accent-strong transition-colors hover:bg-surface-2"
              >
                Today
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
