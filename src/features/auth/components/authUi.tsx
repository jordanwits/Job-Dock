import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  forwardRef,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/**
 * Auth-flow UI primitives.
 *
 * The login / signup / password-reset screens are deliberately pinned to the
 * light teal palette and must NOT follow the in-app dark/light toggle, so these
 * controls are purely token-driven (canvas / surface / ink / line / accent) and
 * never read ThemeContext. Pair them with the `auth-scope` wrapper (see
 * index.css), which shadows the dark-theme tokens for the whole subtree. This
 * keeps the shared components/ui controls untouched for the rest of the app.
 */

/* ── Shared field styling ─────────────────────────────────────────────── */
const fieldBase =
  'h-11 w-full rounded-lg border border-line bg-surface px-3.5 text-[15px] text-ink ' +
  'placeholder:text-ink-subtle outline-none transition-[color,border-color,box-shadow] ' +
  'focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] ' +
  'disabled:cursor-not-allowed disabled:opacity-60'

const fieldErrorCls =
  'border-danger focus:border-danger focus:shadow-[0_0_0_3px_var(--danger-soft)]'

const labelCls = 'mb-1.5 block text-sm font-medium text-ink'
const helperCls = 'mt-1.5 text-[13px] leading-relaxed text-ink-subtle'
const errorCls = 'mt-1.5 text-sm text-danger'

/** Inline accent link styling, for "Sign up" / "Forgot password?" etc. */
export const authLinkCls =
  'font-semibold text-accent-strong transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm'

export interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || props.name
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className={labelCls}>
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(fieldBase, error && fieldErrorCls, className)}
          {...props}
        />
        {error && <p className={errorCls}>{error}</p>}
        {helperText && !error && <p className={helperCls}>{helperText}</p>}
      </div>
    )
  }
)
AuthField.displayName = 'AuthField'

export const AuthPasswordField = forwardRef<HTMLInputElement, AuthFieldProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const [show, setShow] = useState(false)
    const inputId = id || props.name
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className={labelCls}>
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            ref={ref}
            type={show ? 'text' : 'password'}
            className={cn(fieldBase, 'pr-11', error && fieldErrorCls, className)}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            onMouseDown={e => e.preventDefault()}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-subtle transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        {error && <p className={errorCls}>{error}</p>}
        {helperText && !error && <p className={helperCls}>{helperText}</p>}
      </div>
    )
  }
)
AuthPasswordField.displayName = 'AuthPasswordField'

/* ── Button ───────────────────────────────────────────────────────────── */
export interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'subtle'
  isLoading?: boolean
  fullWidth?: boolean
}

export const AuthButton = forwardRef<HTMLButtonElement, AuthButtonProps>(
  (
    { className, variant = 'primary', isLoading, fullWidth, disabled, children, ...props },
    ref
  ) => {
    const base =
      'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-[15px] font-semibold ' +
      'transition-[opacity,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 ' +
      'focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ' +
      'disabled:pointer-events-none disabled:opacity-50'
    const variants = {
      primary: 'bg-accent-strong text-accent-contrast hover:opacity-90',
      subtle: 'bg-surface text-ink ring-1 ring-line hover:bg-surface-hover',
    }
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], fullWidth && 'w-full', className)}
        disabled={disabled ?? isLoading}
        {...props}
      >
        {isLoading && <Spinner />}
        {children}
      </button>
    )
  }
)
AuthButton.displayName = 'AuthButton'

/* ── Alert ────────────────────────────────────────────────────────────── */
type AlertTone = 'danger' | 'warning' | 'info' | 'success'
const alertToneCls: Record<AlertTone, string> = {
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
}

export function AuthAlert({
  tone = 'danger',
  children,
  onDismiss,
}: {
  tone?: AlertTone
  children: ReactNode
  onDismiss?: () => void
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg px-4 py-3 text-sm leading-relaxed',
        alertToneCls[tone]
      )}
    >
      <p className="flex-1">{children}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-0.5 shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

/* ── Page shell + card ────────────────────────────────────────────────── */

/** The contained card holding a form. Borderless + soft shadow, matching the
 *  dashboard's Panel idiom. */
export function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl bg-surface p-7 shadow-card sm:p-8', className)}>{children}</div>
  )
}

/** Centered, full-height auth shell on the warm canvas, with the brand mark.
 *  Wraps everything in `auth-scope` so the subtree ignores the app theme. */
export function AuthShell({
  children,
  tagline = 'Cleaning Management Software',
  footer,
}: {
  children: ReactNode
  tagline?: string
  footer?: ReactNode
}) {
  return (
    <div className="auth-scope flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-8 flex flex-col items-center text-center focus-visible:outline-none"
          aria-label="JobDock home"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface shadow-card ring-1 ring-line">
            <img src="/TJD Icon transparent.png" alt="" className="h-8 w-auto" />
          </span>
          <span className="mt-4 text-2xl font-bold tracking-tight text-ink">JobDock</span>
          <span className="mt-1 text-sm text-ink-muted">{tagline}</span>
        </Link>
        {children}
        {footer && <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>}
      </div>
    </div>
  )
}

/* ── Icons ────────────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <svg className="-ml-1 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
      />
    </svg>
  )
}
