import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
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
import type { Tone } from './invoiceStatus'

export type { Tone }

/**
 * Invoices UI primitives — token-driven.
 *
 * Mirrors the dashboard / contacts / quotes / jobs design language (canvas /
 * surface / ink / line / accent, mono numbers, bare-vs-contained, soft-shadow
 * panels). Reads only the semantic CSS-variable tokens so it follows the app's
 * light/dark toggle, and deliberately does NOT use the shared `components/ui`
 * controls (still navy/gold) — the same self-contained pattern as
 * `authUi.tsx` / `crmUi.tsx` / `quotesUi.tsx` / `jobLogsUi.tsx`.
 */

/* ── Tones ────────────────────────────────────────────────────────────── */
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
export const PlusIcon = (p: IconProps) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
export const SearchIcon = (p: IconProps) => <Svg {...p}><path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></Svg>
export const TrashIcon = (p: IconProps) => <Svg {...p}><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></Svg>
export const ChevronDownIcon = (p: IconProps) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>
export const ChevronLeftIcon = (p: IconProps) => <Svg {...p}><path d="M15 18l-6-6 6-6" /></Svg>
export const ChevronRightIcon = (p: IconProps) => <Svg {...p}><path d="M9 18l6-6-6-6" /></Svg>
export const CheckIcon = (p: IconProps) => <Svg {...p} strokeWidth={2.25}><path d="M5 13l4 4L19 7" /></Svg>
export const CheckCircleIcon = (p: IconProps) => <Svg {...p}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></Svg>
export const XIcon = (p: IconProps) => <Svg {...p} strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></Svg>
export const AlertIcon = (p: IconProps) => <Svg {...p}><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></Svg>
export const InfoIcon = (p: IconProps) => <Svg {...p}><path d="M12 16v-4m0-4h.01M12 22a10 10 0 100-20 10 10 0 000 20z" /></Svg>
export const CalendarIcon = (p: IconProps) => <Svg {...p}><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></Svg>
export const DocumentIcon = (p: IconProps) => <Svg {...p}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></Svg>
export const ClockIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
export const CameraIcon = (p: IconProps) => <Svg {...p}><path d="M3 9a2 2 0 012-2h1.5l1-2h7l1 2H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3.5" /></Svg>
export const ImageIcon = (p: IconProps) => <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></Svg>
export const MapPinIcon = (p: IconProps) => <Svg {...p}><path d="M12 21s7-5.686 7-11a7 7 0 10-14 0c0 5.314 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></Svg>
export const UserIcon = (p: IconProps) => <Svg {...p}><path d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87" /></Svg>
export const UsersIcon = (p: IconProps) => <Svg {...p}><path d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 00-3-6.5" /></Svg>
export const PhoneIcon = (p: IconProps) => <Svg {...p}><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></Svg>
export const MailIcon = (p: IconProps) => <Svg {...p}><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></Svg>
export const PencilIcon = (p: IconProps) => <Svg {...p}><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></Svg>
export const DollarIcon = (p: IconProps) => <Svg {...p}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></Svg>
export const PinIcon = (p: IconProps) => <Svg {...p}><path d="M9 4h6l-1 7 4 3v2H6v-2l4-3-1-7zM12 16v5" /></Svg>
export const ArchiveIcon = (p: IconProps) => <Svg {...p}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8M10 12h4" /></Svg>
export const SendIcon = (p: IconProps) => <Svg {...p}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></Svg>
export const ReceiptIcon = (p: IconProps) => <Svg {...p}><path d="M4 3h16v18l-3-2-3 2-3-2-3 2V3z" /><path d="M8 8h8M8 12h8" /></Svg>
export const ExternalLinkIcon = (p: IconProps) => <Svg {...p}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></Svg>
export const RefreshIcon = (p: IconProps) => <Svg {...p}><path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5" /></Svg>
export const PlayIcon = (p: IconProps) => <Svg {...p}><path d="M6 4l14 8-14 8V4z" /></Svg>
export const PauseIcon = (p: IconProps) => <Svg {...p}><path d="M8 5v14M16 5v14" /></Svg>
export const StopIcon = (p: IconProps) => <Svg {...p}><rect x="6" y="6" width="12" height="12" rx="2" /></Svg>
export const CardsIcon = (p: IconProps) => <Svg {...p} strokeWidth={2}><path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></Svg>
export const ListIcon = (p: IconProps) => <Svg {...p} strokeWidth={2}><path d="M4 6h16M4 12h16M4 18h16" /></Svg>

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4 animate-spin', className)} fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

/* ── Button ───────────────────────────────────────────────────────────── */
type ButtonVariant = 'primary' | 'subtle' | 'ghost' | 'danger' | 'dangerGhost'
export interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  isLoading?: boolean
  fullWidth?: boolean
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent-strong text-accent-contrast hover:opacity-90',
  subtle: 'bg-surface text-ink ring-1 ring-inset ring-line hover:bg-surface-hover',
  ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90',
  dangerGhost: 'text-danger hover:bg-danger-soft',
}

export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, fullWidth, disabled, children, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-[opacity,background-color,color] ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ' +
      'disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap'
    const sizes = { sm: 'h-9 px-3 text-[13px]', md: 'h-10 px-4 text-sm' }
    return (
      <button
        ref={ref}
        className={cn(base, sizes[size], buttonVariants[variant], fullWidth && 'w-full', className)}
        disabled={disabled ?? isLoading}
        {...props}
      >
        {isLoading && <Spinner className="-ml-0.5" />}
        {children}
      </button>
    )
  }
)
AppButton.displayName = 'AppButton'

/* ── Field shells ─────────────────────────────────────────────────────── */
export const fieldBase =
  'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink ' +
  'placeholder:text-ink-subtle outline-none transition-[color,border-color,box-shadow] ' +
  'focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] ' +
  'disabled:cursor-not-allowed disabled:opacity-60'
export const fieldErrorCls = 'border-danger focus:border-danger focus:shadow-[0_0_0_3px_var(--danger-soft)]'
export const labelCls = 'mb-1.5 block text-sm font-medium text-ink'
export const helperCls = 'mt-1.5 text-[13px] leading-relaxed text-ink-subtle'
export const errorTextCls = 'mt-1.5 text-[13px] text-danger'

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: ReactNode
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ className, label, error, helperText, leftIcon, id, ...props }, ref) => {
    const inputId = id || props.name
    return (
      <div className="w-full">
        {label && <label htmlFor={inputId} className={labelCls}>{label}</label>}
        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle">{leftIcon}</span>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(fieldBase, leftIcon && 'pl-10', error && fieldErrorCls, className)}
            {...props}
          />
        </div>
        {error && <p className={errorTextCls}>{error}</p>}
        {helperText && !error && <p className={helperCls}>{helperText}</p>}
      </div>
    )
  }
)
TextField.displayName = 'TextField'

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const areaId = id || props.name
    return (
      <div className="w-full">
        {label && <label htmlFor={areaId} className={labelCls}>{label}</label>}
        <textarea
          id={areaId}
          ref={ref}
          className={cn(
            'min-h-[100px] w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink',
            'placeholder:text-ink-subtle outline-none transition-[color,border-color,box-shadow]',
            'focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60',
            error && fieldErrorCls,
            className
          )}
          {...props}
        />
        {error && <p className={errorTextCls}>{error}</p>}
        {helperText && !error && <p className={helperCls}>{helperText}</p>}
      </div>
    )
  }
)
TextAreaField.displayName = 'TextAreaField'

export interface SelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'value' | 'onChange' | 'onBlur' | 'size'> {
  label?: string
  error?: string
  helperText?: string
  options: Array<{ value: string; label: string }>
  placeholder?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void
  menuClassName?: string
}

/**
 * Custom token-styled select. Renders a hidden native <select> (kept in sync so
 * react-hook-form's register/ref/onChange keep working) plus a button trigger
 * and a token popover for the options.
 */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  (
    { className, menuClassName, label, error, helperText, options, value, onChange, onBlur, name, id, disabled, placeholder, 'aria-label': ariaLabel, ...rest },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const selectRef = useRef<HTMLSelectElement>(null)
    useImperativeHandle(ref, () => selectRef.current as HTMLSelectElement)
    const selectId = id || name

    useEffect(() => {
      const onDoc = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false)
          if (onBlur && selectRef.current) {
            onBlur({ target: selectRef.current } as React.FocusEvent<HTMLSelectElement>)
          }
        }
      }
      if (isOpen) document.addEventListener('mousedown', onDoc)
      return () => document.removeEventListener('mousedown', onDoc)
    }, [isOpen, onBlur])

    useEffect(() => {
      if (!isOpen) return
      const t = setTimeout(
        () => dropdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
        10
      )
      return () => clearTimeout(t)
    }, [isOpen])

    const selected = options.find(o => o.value === value)
    const displayValue = selected ? selected.label : placeholder ?? 'Select an option'

    const choose = (optionValue: string) => {
      if (selectRef.current) {
        selectRef.current.value = optionValue
        onChange?.({
          target: selectRef.current,
          currentTarget: selectRef.current,
          type: 'change',
        } as React.ChangeEvent<HTMLSelectElement>)
      }
      setIsOpen(false)
    }

    return (
      <div className={cn('w-full', className)}>
        {label && <label htmlFor={selectId} className={labelCls}>{label}</label>}

        {/* Hidden native select keeps react-hook-form happy */}
        <select
          ref={selectRef}
          id={selectId}
          name={name}
          value={value ?? ''}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          className="hidden"
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <div className="relative w-full" ref={containerRef}>
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(o => !o)}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-label={ariaLabel}
            className={cn(
              'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-sm outline-none transition-[border-color,box-shadow]',
              'focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]',
              'disabled:cursor-not-allowed disabled:opacity-60',
              isOpen && 'border-accent shadow-[0_0_0_3px_var(--accent-soft)]',
              error && fieldErrorCls,
              selected ? 'text-ink' : 'text-ink-subtle'
            )}
          >
            <span className="truncate">{displayValue}</span>
            <ChevronDownIcon className={cn('h-4 w-4 shrink-0 text-ink-subtle transition-transform', isOpen && 'rotate-180')} />
          </button>

          {isOpen && (
            <div
              ref={dropdownRef}
              role="listbox"
              className={cn(
                'absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-xl bg-surface p-1.5 shadow-pop ring-1 ring-line',
                menuClassName
              )}
            >
              {options.map(o => {
                const isSel = value === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onClick={() => choose(o.value)}
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

        {error && <p className={errorTextCls}>{error}</p>}
        {helperText && !error && <p className={helperCls}>{helperText}</p>}
      </div>
    )
  }
)
SelectField.displayName = 'SelectField'

/* ── Date field (token calendar popover) ──────────────────────────────── */
const parseDateStringAsLocal = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export interface DateFieldProps {
  value?: string
  onChange?: (date: string) => void
  label?: string
  error?: string
  helperText?: string
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
  error,
  helperText,
  placeholder = 'Select a date',
  disabled = false,
  minDate,
  maxDate,
  className,
}: DateFieldProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(value ? parseDateStringAsLocal(value) : new Date())
  const containerRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('mousedown', onDoc)
      const t = setTimeout(
        () => calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
        50
      )
      return () => {
        document.removeEventListener('mousedown', onDoc)
        clearTimeout(t)
      }
    }
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
            isOpen && 'border-accent shadow-[0_0_0_3px_var(--accent-soft)]',
            error && fieldErrorCls
          )}
        >
          <span className={cn('flex-1 truncate', value ? 'text-ink' : 'text-ink-subtle')}>
            {value ? formatDisplayDate(value) : placeholder}
          </span>
          <CalendarIcon className="h-4 w-4 shrink-0 text-ink-subtle" />
        </button>

        {isOpen && (
          <div
            ref={calendarRef}
            className="absolute z-50 mt-2 w-full min-w-[280px] rounded-xl bg-surface p-4 shadow-pop ring-1 ring-line"
          >
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
      {error && <p className={errorTextCls}>{error}</p>}
      {helperText && !error && <p className={helperCls}>{helperText}</p>}
    </div>
  )
}

/* ── Searchable select (token) ────────────────────────────────────────── */
export interface SearchableSelectFieldProps {
  label?: string
  error?: string
  helperText?: string
  options: Array<{ value: string; label: string }>
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
}

export function SearchableSelectField({
  label,
  error,
  helperText,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search...',
  disabled,
  className,
}: SearchableSelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedOption = options.find(o => o.value === value)
  const displayValue = selectedOption ? selectedOption.label : placeholder
  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setQuery('')
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', onDoc)
      const t = setTimeout(() => {
        searchInputRef.current?.focus()
        dropdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 10)
      return () => {
        document.removeEventListener('mousedown', onDoc)
        clearTimeout(t)
      }
    }
  }, [isOpen])

  const handleSelect = (optionValue: string) => {
    onChange?.(optionValue)
    setIsOpen(false)
    setQuery('')
  }

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
            error && fieldErrorCls,
            selectedOption ? 'text-ink' : 'text-ink-subtle'
          )}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronDownIcon className={cn('h-4 w-4 shrink-0 text-ink-subtle transition-transform', isOpen && 'rotate-180')} />
        </button>

        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-2 flex max-h-80 w-full flex-col overflow-hidden rounded-xl bg-surface shadow-pop ring-1 ring-line"
          >
            <div className="border-b border-line p-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle">
                  <SearchIcon className="h-4 w-4" />
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  onClick={e => e.stopPropagation()}
                  className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-ink-subtle outline-none transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto p-1.5">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-ink-subtle">
                  {query ? 'No results found' : 'No options available'}
                </div>
              ) : (
                filteredOptions.map(option => {
                  const isSel = value === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className={cn(
                        'block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                        isSel ? 'bg-accent-soft font-medium text-accent-strong' : 'text-ink hover:bg-surface-2'
                      )}
                    >
                      {option.label}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
      {error && <p className={errorTextCls}>{error}</p>}
      {helperText && !error && <p className={helperCls}>{helperText}</p>}
    </div>
  )
}

/* ── Checkbox ─────────────────────────────────────────────────────────── */
export function CheckboxField({
  checked,
  onChange,
  label,
  description,
  id,
  className,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  description?: ReactNode
  id?: string
  className?: string
}) {
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-3', className)}>
      <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-line-strong bg-surface outline-none transition-colors checked:border-accent-strong checked:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        />
        <CheckIcon className="pointer-events-none absolute h-3.5 w-3.5 text-accent-contrast opacity-0 peer-checked:opacity-100" />
      </span>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium text-ink">{label}</span>}
          {description && <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-subtle">{description}</span>}
        </span>
      )}
    </label>
  )
}

/* ── Status badge (static) ────────────────────────────────────────────── */
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

/* ── Status select (interactive badge dropdown) ───────────────────────── */
export function StatusSelect({
  value,
  options,
  onChange,
  isLoading = false,
  disabled = false,
}: {
  value: string
  options: { value: string; label: string; tone: Tone }[]
  onChange: (value: string) => void
  isLoading?: boolean
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const current = options.find(o => o.value.toLowerCase() === (value ?? '').toLowerCase())
  const tone = current?.tone ?? 'neutral'
  const isDisabled = disabled || isLoading

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => !isDisabled && setOpen(o => !o)}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold capitalize transition-opacity',
          softPillCls[tone],
          'hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          isDisabled && 'cursor-not-allowed opacity-60'
        )}
      >
        {isLoading && <Spinner className="h-3 w-3" />}
        <span>{current?.label ?? value}</span>
        {!isDisabled && <ChevronDownIcon className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />}
      </button>
      {open && !isDisabled && (
        <div className="absolute right-0 z-50 mt-2 min-w-[160px] overflow-hidden rounded-xl bg-surface p-1.5 shadow-pop ring-1 ring-line">
          {options.map(o => {
            const selected = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  if (o.value !== value) onChange(o.value)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  selected ? 'bg-accent-soft font-semibold text-accent-strong' : 'text-ink hover:bg-surface-2'
                )}
              >
                <Dot tone={o.tone} />
                <span className="capitalize">{o.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Selection circle (bulk-select) ───────────────────────────────────── */
export function SelectCircle({
  selected,
  onClick,
  className,
  label = 'Select',
}: {
  selected: boolean
  onClick: (e: React.MouseEvent) => void
  className?: string
  label?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        selected
          ? 'border-accent-strong bg-accent-strong text-accent-contrast'
          : 'border-line-strong bg-surface hover:border-accent',
        className
      )}
    >
      {selected && <CheckIcon className="h-3 w-3" />}
    </button>
  )
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

/* ── Tag chip ─────────────────────────────────────────────────────────── */
export function TagChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-muted">
      {children}
    </span>
  )
}

/* ── Section header (bare, on canvas) ─────────────────────────────────── */
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3.5 flex items-baseline justify-between gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
      {action}
    </div>
  )
}

/* ── Panel — the one contained surface ────────────────────────────────── */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl bg-surface shadow-card', className)}>{children}</div>
}

/* ── Empty state ──────────────────────────────────────────────────────── */
export function EmptyState({ icon, title, action }: { icon?: ReactNode; title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      {icon && <span className="text-ink-subtle">{icon}</span>}
      <p className="max-w-[36ch] text-sm text-ink-muted">{title}</p>
      {action}
    </div>
  )
}

/* ── Alert ────────────────────────────────────────────────────────────── */
const alertToneCls: Record<'danger' | 'warning' | 'info' | 'success', string> = {
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
}

export function Alert({
  tone = 'danger',
  children,
  onDismiss,
  icon,
}: {
  tone?: 'danger' | 'warning' | 'info' | 'success'
  children: ReactNode
  onDismiss?: () => void
  icon?: ReactNode
}) {
  return (
    <div role="alert" className={cn('flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm leading-relaxed', alertToneCls[tone])}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-0.5 shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

/* ── Tabs (underline) ─────────────────────────────────────────────────── */
export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: string; label: ReactNode }[]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-1 border-b border-line', className)}>
      {tabs.map(t => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none',
              active
                ? 'border-accent-strong text-accent-strong'
                : 'border-transparent text-ink-muted hover:text-ink'
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

/* ── Modal ────────────────────────────────────────────────────────────────
   Token-styled modal. Behavior (scroll lock, portal, escape, iOS handling) is
   ported from the shared components/ui/Modal so the jobs surface keeps the same
   robustness without pulling in the navy/gold chrome. */
export interface AppModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  headerRight?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnOverlayClick?: boolean
  showCloseButton?: boolean
}

const modalSizes: Record<NonNullable<AppModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function AppModal({
  isOpen,
  onClose,
  title,
  headerRight,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = false,
  showCloseButton = true,
}: AppModalProps) {
  const scrollYRef = useRef(0)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      scrollYRef.current = window.scrollY
      document.documentElement.style.height = '100vh'
      document.documentElement.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollYRef.current}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.width = '100%'
      document.body.style.height = '100vh'
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.documentElement.style.height = ''
      document.documentElement.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.width = ''
      document.body.style.height = ''
      document.body.style.overflow = 'unset'
      window.scrollTo(0, scrollYRef.current)
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onCloseRef.current()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  if (!isOpen) return null

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/40 p-[max(0.75rem,env(safe-area-inset-top,0px))] sm:bg-black/30 sm:p-4 sm:backdrop-blur-sm"
      onMouseDown={closeOnOverlayClick ? e => { if (e.target === e.currentTarget) onClose() } : undefined}
    >
      <div
        className={cn(
          'relative my-auto flex max-h-[92dvh] w-full min-h-0 flex-col overflow-hidden rounded-2xl bg-surface shadow-pop sm:max-h-[85vh]',
          modalSizes[size]
        )}
        onMouseDown={e => e.stopPropagation()}
      >
        {(title || headerRight || showCloseButton) && (
          <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-line px-5 py-4 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {title && <h2 className="truncate text-lg font-semibold tracking-tight text-ink sm:text-xl">{title}</h2>}
              {headerRight && <span className="shrink-0 text-sm text-ink-muted">{headerRight}</span>}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1.5 shrink-0 rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <XIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        <div
          className="custom-scrollbar min-h-0 flex-1 touch-pan-y overflow-y-auto overflow-x-hidden px-5 py-5 pb-8 sm:px-6 sm:pb-6"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>

        {footer && (
          <div className="flex flex-shrink-0 flex-col items-stretch justify-end gap-2 overflow-visible border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:gap-3 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

/** Inline accent link styling. */
export const linkCls =
  'font-medium text-accent-strong transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm'
