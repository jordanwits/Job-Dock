/**
 * Shared UI kit for the public, unauthenticated customer pages (online booking,
 * quote approval, invoice view, reschedule, short links). Token-based (teal
 * light-default design system) — the counterpart of the per-feature *Ui.tsx
 * kits used inside the authed app. The tenant's own branding (logo / company
 * name) leads every page; JobDock stays in the footer.
 */
import { forwardRef, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import PhoneInput, { type PhoneInputProps } from '@/components/ui/PhoneInput'

/* ── Branding ─────────────────────────────────────────────────────────── */

export interface PublicBranding {
  logoSignedUrl?: string | null
  name?: string | null
}

/** Tenant logo and/or company name; falls back to a plain JobDock wordmark. */
export function BrandingMark({ branding, size = 'md', className }: { branding?: PublicBranding | null; size?: 'md' | 'lg'; className?: string }) {
  const logo = branding?.logoSignedUrl
  const name = branding?.name
  const logoCls = size === 'lg' ? 'h-12 max-w-[200px]' : 'h-9 max-w-[160px]'
  const nameCls = size === 'lg' ? 'text-xl' : 'text-base'
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      {logo && (
        <img src={logo} alt={name || 'Company logo'} className={cn('w-auto shrink-0 object-contain', logoCls)} />
      )}
      {name ? (
        <span className={cn('truncate font-semibold tracking-tight text-ink', nameCls)}>{name}</span>
      ) : (
        !logo && <span className={cn('font-semibold tracking-tight text-ink', nameCls)}>JobDock</span>
      )}
    </div>
  )
}

/* ── Page shells ──────────────────────────────────────────────────────── */

/** Full-page shell: branded header bar, canvas body, quiet JobDock footer. */
export function PublicShell({ branding, title, subtitle, children, width = 'max-w-6xl' }: {
  branding?: PublicBranding | null
  title: string
  subtitle?: string
  children: ReactNode
  width?: string
}) {
  return (
    <div className="safe-area-inset flex min-h-[100dvh] flex-col bg-canvas">
      <header className="shrink-0 border-b border-line bg-surface">
        <div className={cn('mx-auto w-full px-4 py-4 sm:px-6', width)}>
          <BrandingMark branding={branding} />
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
        </div>
      </header>
      <main className={cn('mx-auto w-full flex-1 px-4 py-6 sm:px-6 sm:py-8', width)}>{children}</main>
      <PublicFooter />
    </div>
  )
}

/** Centered single-card shell for confirmations, errors, and short flows. */
export function CenterCard({ branding, children, width = 'max-w-md' }: {
  branding?: PublicBranding | null
  children: ReactNode
  width?: string
}) {
  return (
    <div className="safe-area-inset flex min-h-[100dvh] flex-col bg-canvas">
      <div className="flex flex-1 items-center justify-center p-4">
        <PublicPanel className={cn('w-full p-6 text-center sm:p-8', width)}>
          {(branding?.logoSignedUrl || branding?.name) && (
            <BrandingMark branding={branding} className="mb-6 justify-center" />
          )}
          {children}
        </PublicPanel>
      </div>
      <PublicFooter />
    </div>
  )
}

function PublicFooter() {
  return (
    <footer className="shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-center">
      <a
        href="https://thejobdock.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-ink-subtle transition-colors hover:text-ink-muted"
      >
        Powered by JobDock
      </a>
    </footer>
  )
}

/* ── Surfaces ─────────────────────────────────────────────────────────── */

export function PublicPanel({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={cn('rounded-2xl bg-surface shadow-card ring-1 ring-line', className)} onClick={onClick}>
      {children}
    </div>
  )
}

/* ── Buttons ──────────────────────────────────────────────────────────── */

type PublicButtonVariant = 'primary' | 'subtle' | 'danger'

export interface PublicButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PublicButtonVariant
  isLoading?: boolean
  fullWidth?: boolean
}

const buttonVariants: Record<PublicButtonVariant, string> = {
  primary: 'bg-accent-strong text-accent-contrast hover:opacity-90',
  subtle: 'bg-surface text-ink ring-1 ring-inset ring-line hover:bg-surface-hover',
  danger: 'bg-danger text-white hover:opacity-90',
}

export function PublicButton({ variant = 'primary', isLoading, fullWidth, disabled, className, children, ...props }: PublicButtonProps) {
  return (
    <button
      className={cn(
        // 48px height: these pages are used on phones, mid-errand.
        'inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-6 text-sm font-semibold transition-[opacity,background-color] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:pointer-events-none disabled:opacity-50',
        buttonVariants[variant],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled ?? isLoading}
      {...props}
    >
      {isLoading && <Spinner className="-ml-1 h-4 w-4" />}
      {children}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5 animate-spin text-current', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

/** Full-screen quiet loading state (branding unknown yet). */
export function PublicLoading({ message }: { message: string }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-canvas p-4">
      <Spinner className="h-8 w-8 text-accent-strong" />
      <p className="text-sm text-ink-muted">{message}</p>
    </div>
  )
}

/* ── Status iconography (no emoji) ────────────────────────────────────── */

type StatusKind = 'success' | 'pending' | 'danger' | 'declined'

const statusStyles: Record<StatusKind, { circle: string; icon: string }> = {
  success: { circle: 'bg-success-soft', icon: 'text-success' },
  pending: { circle: 'bg-warning-soft', icon: 'text-warning' },
  danger: { circle: 'bg-danger-soft', icon: 'text-danger' },
  declined: { circle: 'bg-surface-2', icon: 'text-ink-subtle' },
}

const statusPaths: Record<StatusKind, string> = {
  success: 'M5 13l4 4L19 7',
  pending: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  danger: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  declined: 'M18 6L6 18M6 6l12 12',
}

export function StatusCircle({ kind, label }: { kind: StatusKind; label: string }) {
  const s = statusStyles[kind]
  return (
    <div
      className={cn('mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full', s.circle)}
      role="img"
      aria-label={label}
    >
      <svg className={cn('h-8 w-8', s.icon)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={statusPaths[kind]} />
      </svg>
    </div>
  )
}

/* ── Form fields ──────────────────────────────────────────────────────── */

export const publicInputCls =
  'h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60'

function FieldWrap({ label, error, hint, children }: { label?: ReactNode; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="w-full">
      {label && <label className="mb-1.5 block text-sm font-medium text-ink">{label}</label>}
      {children}
      {error && <p className="mt-1.5 text-[13px] text-danger">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-[13px] text-ink-subtle">{hint}</p>}
    </div>
  )
}

export interface PublicTextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  error?: string
  hint?: string
}

export const PublicTextField = forwardRef<HTMLInputElement, PublicTextFieldProps>(
  ({ label, error, hint, className, ...props }, ref) => (
    <FieldWrap label={label} error={error} hint={hint}>
      <input ref={ref} className={cn(publicInputCls, error && 'border-danger focus:border-danger focus:shadow-[0_0_0_3px_var(--danger-soft)]', className)} {...props} />
    </FieldWrap>
  )
)
PublicTextField.displayName = 'PublicTextField'

export interface PublicTextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode
  error?: string
  hint?: string
}

export const PublicTextArea = forwardRef<HTMLTextAreaElement, PublicTextAreaProps>(
  ({ label, error, hint, className, ...props }, ref) => (
    <FieldWrap label={label} error={error} hint={hint}>
      <textarea
        ref={ref}
        className={cn(publicInputCls, 'h-auto min-h-[84px] resize-none py-2.5', error && 'border-danger', className)}
        {...props}
      />
    </FieldWrap>
  )
)
PublicTextArea.displayName = 'PublicTextArea'

export interface PublicSelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode
  error?: string
  options: Array<{ value: string; label: string }>
}

export const PublicSelectField = forwardRef<HTMLSelectElement, PublicSelectFieldProps>(
  ({ label, error, options, className, ...props }, ref) => (
    <FieldWrap label={label} error={error}>
      <div className="relative">
        <select ref={ref} className={cn(publicInputCls, 'appearance-none pr-9', className)} {...props}>
          {options.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </FieldWrap>
  )
)
PublicSelectField.displayName = 'PublicSelectField'

/**
 * Token-styled phone field. Wraps the shared PhoneInput (formatting +
 * autofill-sync logic) but supplies its own label/error and overrides the
 * legacy input styling via className (Input merges className last).
 */
export const PublicPhoneField = forwardRef<HTMLInputElement, PhoneInputProps & { hint?: string }>(
  ({ label, error, hint, className, ...props }, ref) => (
    <FieldWrap label={label} error={error} hint={hint}>
      <PhoneInput
        ref={ref}
        className={cn(
          publicInputCls,
          'focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] focus-visible:ring-0',
          error && 'border-danger',
          className
        )}
        {...props}
      />
    </FieldWrap>
  )
)
PublicPhoneField.displayName = 'PublicPhoneField'
