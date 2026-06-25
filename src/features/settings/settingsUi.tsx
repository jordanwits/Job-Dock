import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { cn } from '@/lib/utils'
import { formatPhoneNumber } from '@/lib/utils/phone'

/**
 * Settings UI primitives — token-driven.
 *
 * Mirrors the dashboard / scheduling / quotes / jobs / invoices / reports design
 * language (canvas / surface / ink / line / accent, mono numbers, bare-vs-
 * contained, soft-shadow panels). Reads only the semantic CSS-variable tokens so
 * it follows the app's light/dark toggle, and deliberately does NOT use the
 * shared `components/ui` controls (still navy/gold) — the same self-contained
 * pattern as `schedulingUi.tsx` / `invoicesUi.tsx` / `reportsUi.tsx`.
 */

/* ── Tones ────────────────────────────────────────────────────────────── */
export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

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
export const TrashIcon = (p: IconProps) => <Svg {...p}><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></Svg>
export const ChevronDownIcon = (p: IconProps) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>
export const ChevronLeftIcon = (p: IconProps) => <Svg {...p}><path d="M15 18l-6-6 6-6" /></Svg>
export const ChevronRightIcon = (p: IconProps) => <Svg {...p}><path d="M9 18l6-6-6-6" /></Svg>
export const CheckIcon = (p: IconProps) => <Svg {...p} strokeWidth={2.25}><path d="M5 13l4 4L19 7" /></Svg>
export const CheckCircleIcon = (p: IconProps) => <Svg {...p}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></Svg>
export const XIcon = (p: IconProps) => <Svg {...p} strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></Svg>
export const AlertIcon = (p: IconProps) => <Svg {...p}><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></Svg>
export const InfoIcon = (p: IconProps) => <Svg {...p}><path d="M12 16v-4m0-4h.01M12 22a10 10 0 100-20 10 10 0 000 20z" /></Svg>
export const UploadIcon = (p: IconProps) => <Svg {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></Svg>
export const ExternalLinkIcon = (p: IconProps) => <Svg {...p}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></Svg>
export const MailIcon = (p: IconProps) => <Svg {...p}><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></Svg>
export const UserIcon = (p: IconProps) => <Svg {...p}><path d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87" /></Svg>
export const UsersIcon = (p: IconProps) => <Svg {...p}><path d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 00-3-6.5" /></Svg>
export const DocumentIcon = (p: IconProps) => <Svg {...p}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></Svg>
export const CopyIcon = (p: IconProps) => <Svg {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></Svg>

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

/* ── Panel ────────────────────────────────────────────────────────────── */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl bg-surface shadow-card', className)}>{children}</div>
}

/* ── Settings section — title + optional description over content ──────── */
export function SettingsSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-6', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
          {description && <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  )
}

/** Sub-heading inside a section (e.g. "Invoice Email"). */
export function SubHeading({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('text-sm font-semibold tracking-tight text-ink', className)}>{children}</h3>
}

/* ── Info panel — quiet contained note (replaces gray boxes) ──────────── */
export function InfoPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg bg-surface-2 p-4 text-sm leading-relaxed text-ink-muted', className)}>
      {children}
    </div>
  )
}

/** Inline mono chip — for template variables / codes. */
export function CodeChip({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-surface px-2 py-1 font-mono text-xs text-accent-strong ring-1 ring-inset ring-line">
      {children}
    </code>
  )
}

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
  ({ className, label, error, helperText, id, rows = 5, ...props }, ref) => {
    const areaId = id || props.name
    return (
      <div className="w-full">
        {label && <label htmlFor={areaId} className={labelCls}>{label}</label>}
        <textarea
          id={areaId}
          ref={ref}
          rows={rows}
          className={cn(
            'w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink',
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

/* ── Phone field (formats as you type) ────────────────────────────────── */
export interface PhoneFieldProps extends Omit<TextFieldProps, 'onChange' | 'value' | 'type'> {
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export const PhoneField = forwardRef<HTMLInputElement, PhoneFieldProps>(
  ({ value, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatPhoneNumber(e.target.value)
      const synthetic = {
        ...e,
        target: { ...e.target, value: formatted },
        currentTarget: { ...e.currentTarget, value: formatted },
      } as React.ChangeEvent<HTMLInputElement>
      onChange?.(synthetic)
    }
    return <TextField {...props} ref={ref} type="tel" value={value ?? ''} onChange={handleChange} />
  }
)
PhoneField.displayName = 'PhoneField'

/* ── Select (token-styled, hidden native select keeps RHF happy) ──────── */
export interface SelectFieldProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'value' | 'onChange' | 'onBlur' | 'size'> {
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

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  (
    { className, menuClassName, label, error, helperText, options, value, onChange, onBlur, name, id, disabled, placeholder, 'aria-label': ariaLabel, ...rest },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
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

/* ── Checkbox ─────────────────────────────────────────────────────────── */
export function CheckboxField({
  checked,
  onChange,
  label,
  description,
  id,
  disabled,
  className,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  description?: ReactNode
  id?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-60', className)}>
      <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={e => onChange(e.target.checked)}
          className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-line-strong bg-surface outline-none transition-colors checked:border-accent-strong checked:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed"
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

/* ── Toggle switch ────────────────────────────────────────────────────── */
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  description,
  id,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: ReactNode
  description?: ReactNode
  id?: string
}) {
  const button = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        checked ? 'bg-accent-strong' : 'bg-line-strong',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        )}
      />
    </button>
  )
  if (!label && !description) return button
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {label && <p className="text-sm font-medium text-ink">{label}</p>}
        {description && <p className="mt-0.5 text-[13px] leading-relaxed text-ink-subtle">{description}</p>}
      </div>
      {button}
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

/* ── Avatar ───────────────────────────────────────────────────────────── */
export function Avatar({ name, size = 'md' }: { name?: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = (name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p.charAt(0))
    .join('')
    .toUpperCase()
  const sizes = { sm: 'h-9 w-9 text-[13px]', md: 'h-11 w-11 text-sm', lg: 'h-14 w-14 text-lg' }
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-strong', sizes[size])}
      aria-hidden
    >
      {initials || '?'}
    </span>
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
  className,
}: {
  tone?: 'danger' | 'warning' | 'info' | 'success'
  children: ReactNode
  onDismiss?: () => void
  icon?: ReactNode
  className?: string
}) {
  return (
    <div role="alert" className={cn('flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm leading-relaxed', alertToneCls[tone], className)}>
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

/** Inline accent link styling. */
export const linkCls =
  'font-medium text-accent-strong transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm'
