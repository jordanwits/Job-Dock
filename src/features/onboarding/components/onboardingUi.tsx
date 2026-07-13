import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  forwardRef,
  useEffect,
  useState,
} from 'react'
import { cn } from '@/lib/utils'
import { formatPhoneNumber } from '@/lib/utils/phone'

/**
 * Onboarding UI primitives — token-driven.
 *
 * The first-run onboarding flow (welcome → company info → logo → tour) is styled
 * with the app's semantic CSS-variable tokens (canvas / surface / ink / line /
 * accent), so it follows the light/dark toggle automatically and matches the
 * rebranded dashboard, contacts, quotes, jobs, invoices and calendar surfaces.
 * Like the other feature UI modules it deliberately does NOT reuse the shared
 * navy/gold `components/ui` controls, keeping the rebrand scoped.
 */

/* ── Icons ────────────────────────────────────────────────────────────── */
type IconProps = { className?: string }
const Svg = ({
  className,
  children,
  strokeWidth = 1.75,
}: {
  className?: string
  children: ReactNode
  strokeWidth?: number
}) => (
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

export const CheckIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={2.25}>
    <path d="M5 13l4 4L19 7" />
  </Svg>
)
export const BuildingIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 21h18M5 21V5a2 2 0 012-2h6a2 2 0 012 2v16M9 7h2m-2 4h2m-2 4h2m6-6h2a2 2 0 012 2v9" />
  </Svg>
)
export const ImageIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </Svg>
)
export const CompassIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
  </Svg>
)
export const SparkleIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l1.9 4.8L18.8 9l-4.9 1.9L12 15.8 10.1 11 5.2 9l4.9-1.2L12 3z" />
  </Svg>
)
export const UploadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </Svg>
)
export const ArrowLeftIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={2}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </Svg>
)

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-4 w-4 animate-spin', className)}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

/* ── Button ───────────────────────────────────────────────────────────── */
type ButtonVariant = 'primary' | 'subtle' | 'ghost'
export interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  isLoading?: boolean
  fullWidth?: boolean
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent-strong text-accent-contrast hover:opacity-90',
  subtle: 'bg-surface text-ink ring-1 ring-inset ring-line hover:bg-surface-hover',
  ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
}

export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(
  ({ className, variant = 'primary', isLoading, fullWidth, disabled, children, ...props }, ref) => {
    const base =
      'inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold ' +
      'transition-[opacity,background-color,color] focus-visible:outline-none focus-visible:ring-2 ' +
      'focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ' +
      'disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap'
    return (
      <button
        ref={ref}
        className={cn(base, buttonVariants[variant], fullWidth && 'w-full', className)}
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
const fieldBase =
  'h-11 w-full rounded-lg border border-line bg-surface px-3.5 text-[15px] text-ink ' +
  'placeholder:text-ink-subtle outline-none transition-[color,border-color,box-shadow] ' +
  'focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] ' +
  'disabled:cursor-not-allowed disabled:opacity-60'
const fieldErrorCls =
  'border-danger focus:border-danger focus:shadow-[0_0_0_3px_var(--danger-soft)]'
const labelCls = 'mb-1.5 block text-sm font-medium text-ink'
const helperCls = 'mt-1.5 text-[13px] leading-relaxed text-ink-subtle'
const errorTextCls = 'mt-1.5 text-[13px] text-danger'

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
        {label && (
          <label htmlFor={inputId} className={labelCls}>
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle">
              {leftIcon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(fieldBase, leftIcon && 'pl-11', error && fieldErrorCls, className)}
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

/** Phone field — formats as the user types. */
export const PhoneField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ value, onChange, onBlur, ...props }, ref) => {
    const [display, setDisplay] = useState((value as string) || '')
    useEffect(() => {
      if (value !== undefined) setDisplay(value as string)
    }, [value])
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatPhoneNumber(e.target.value)
      setDisplay(formatted)
      onChange?.({
        ...e,
        target: { ...e.target, value: formatted },
      } as React.ChangeEvent<HTMLInputElement>)
    }
    return (
      <TextField
        {...props}
        ref={ref}
        type="tel"
        inputMode="tel"
        value={display}
        onChange={handleChange}
        onBlur={onBlur}
      />
    )
  }
)
PhoneField.displayName = 'PhoneField'

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
}: {
  tone?: 'danger' | 'warning' | 'info' | 'success'
  children: ReactNode
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm leading-relaxed',
        alertToneCls[tone]
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/* ── Card ─────────────────────────────────────────────────────────────── */
/** The contained card holding a step. Borderless + soft shadow. */
export function OnboardingCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-2xl bg-surface p-7 shadow-card sm:p-8', className)}>{children}</div>
  )
}
