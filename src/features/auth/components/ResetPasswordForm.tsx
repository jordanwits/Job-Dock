import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import {
  resetPasswordSchema,
  confirmResetPasswordSchema,
  type ResetPasswordFormData,
  type ConfirmResetPasswordFormData,
} from '../schemas/authSchemas'
import { useAuthStore } from '../store/authStore'
import { AuthField, AuthPasswordField, AuthButton, AuthAlert, authLinkCls } from './authUi'

const ResetPasswordForm = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() || ''
  const hasToken = token.length > 0

  const [requestSent, setRequestSent] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const { resetPassword, confirmResetPassword, isLoading, error, clearError } = useAuthStore()

  const requestForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const confirmForm = useForm<ConfirmResetPasswordFormData>({
    resolver: zodResolver(confirmResetPasswordSchema),
  })

  const onRequest = async (data: ResetPasswordFormData) => {
    clearError()
    try {
      await resetPassword(data.email)
      setRequestSent(true)
    } catch {
      // handled by store
    }
  }

  const onConfirm = async (data: ConfirmResetPasswordFormData) => {
    clearError()
    try {
      await confirmResetPassword(token, data.newPassword)
      setConfirmed(true)
    } catch {
      // handled by store
    }
  }

  // Success state — either flow can land here.
  if (confirmed) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft">
            <svg className="h-7 w-7 text-accent-strong" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Password reset</h2>
          <p className="mt-1.5 text-[15px] text-ink-muted">
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
        </div>
        <AuthButton type="button" fullWidth onClick={() => navigate('/auth/login')}>
          Go to sign in
        </AuthButton>
      </div>
    )
  }

  // Phase 2: user arrived via the link in their email — show new-password form.
  if (hasToken) {
    return (
      <form onSubmit={confirmForm.handleSubmit(onConfirm)} className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Choose a new password</h2>
          <p className="mt-1.5 text-[15px] text-ink-muted">Enter a new password for your account.</p>
        </div>

        {error && <AuthAlert>{error}</AuthAlert>}

        <div className="space-y-4">
          <AuthPasswordField
            label="New password"
            autoComplete="new-password"
            placeholder="Enter new password"
            error={confirmForm.formState.errors.newPassword?.message}
            {...confirmForm.register('newPassword')}
          />

          <AuthPasswordField
            label="Confirm new password"
            autoComplete="new-password"
            placeholder="Re-enter new password"
            error={confirmForm.formState.errors.confirmPassword?.message}
            {...confirmForm.register('confirmPassword')}
          />
        </div>

        <AuthButton type="submit" fullWidth isLoading={isLoading}>
          {isLoading ? 'Resetting...' : 'Reset password'}
        </AuthButton>

        <div className="text-center text-sm text-ink-muted">
          <Link to="/auth/login" className={authLinkCls}>
            Back to sign in
          </Link>
        </div>
      </form>
    )
  }

  // Phase 1a: request sent — show a confirmation message (no code entry, the
  // user clicks the link in their email to continue).
  if (requestSent) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Check your email</h2>
          <p className="mt-1.5 text-[15px] text-ink-muted">
            If an account exists for that email, we've sent a link to reset your password. The link
            expires in 60 minutes.
          </p>
        </div>
        <div className="text-center text-sm text-ink-muted">
          Didn't get it?{' '}
          <button
            type="button"
            onClick={() => {
              clearError()
              setRequestSent(false)
            }}
            className={authLinkCls}
          >
            Try again
          </button>
        </div>
        <AuthButton type="button" variant="subtle" fullWidth onClick={() => navigate('/auth/login')}>
          Back to sign in
        </AuthButton>
      </div>
    )
  }

  // Phase 1: request the reset link.
  return (
    <form onSubmit={requestForm.handleSubmit(onRequest)} className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Reset password</h2>
        <p className="mt-1.5 text-[15px] text-ink-muted">
          Enter your email and we'll send you a link to choose a new password.
        </p>
      </div>

      {error && <AuthAlert>{error}</AuthAlert>}

      <AuthField
        label="Email"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        error={requestForm.formState.errors.email?.message}
        {...requestForm.register('email')}
      />

      <AuthButton type="submit" fullWidth isLoading={isLoading}>
        {isLoading ? 'Sending...' : 'Send reset link'}
      </AuthButton>

      <div className="text-center text-sm text-ink-muted">
        Remember your password?{' '}
        <Link to="/auth/login" className={authLinkCls}>
          Sign in
        </Link>
      </div>
    </form>
  )
}

export default ResetPasswordForm
