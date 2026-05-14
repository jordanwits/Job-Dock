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
import { Input, Button } from '@/components/ui'

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
          <div className="mx-auto w-16 h-16 rounded-full bg-primary-gold/20 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-primary-gold"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-primary-light mb-2">Password reset</h2>
          <p className="text-primary-light/70">
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
        </div>
        <Button type="button" className="w-full" onClick={() => navigate('/auth/login')}>
          Go to sign in
        </Button>
      </div>
    )
  }

  // Phase 2: user arrived via the link in their email — show new-password form.
  if (hasToken) {
    return (
      <form onSubmit={confirmForm.handleSubmit(onConfirm)} className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-primary-light mb-2">Choose a new password</h2>
          <p className="text-primary-light/70">
            Enter a new password for your account.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500 p-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="Enter new password"
          error={confirmForm.formState.errors.newPassword?.message}
          {...confirmForm.register('newPassword')}
        />

        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter new password"
          error={confirmForm.formState.errors.confirmPassword?.message}
          {...confirmForm.register('confirmPassword')}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Resetting...' : 'Reset password'}
        </Button>

        <div className="text-center text-sm text-primary-light/70">
          <Link
            to="/auth/login"
            className="text-primary-gold hover:text-primary-gold/80 font-medium transition-colors"
          >
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
          <h2 className="text-3xl font-bold text-primary-light mb-2">Check your email</h2>
          <p className="text-primary-light/70">
            If an account exists for that email, we've sent a link to reset your password.
            The link expires in 60 minutes.
          </p>
        </div>
        <div className="text-center text-sm text-primary-light/70">
          Didn't get it?{' '}
          <button
            type="button"
            onClick={() => {
              clearError()
              setRequestSent(false)
            }}
            className="text-primary-gold hover:text-primary-gold/80 font-medium transition-colors"
          >
            Try again
          </button>
        </div>
        <Button type="button" className="w-full" onClick={() => navigate('/auth/login')}>
          Back to sign in
        </Button>
      </div>
    )
  }

  // Phase 1: request the reset link.
  return (
    <form onSubmit={requestForm.handleSubmit(onRequest)} className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-primary-light mb-2">Reset password</h2>
        <p className="text-primary-light/70">
          Enter your email and we'll send you a link to choose a new password.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500 p-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      <Input
        label="Email"
        type="email"
        placeholder="you@example.com"
        error={requestForm.formState.errors.email?.message}
        {...requestForm.register('email')}
      />

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Sending...' : 'Send reset link'}
      </Button>

      <div className="text-center text-sm text-primary-light/70">
        Remember your password?{' '}
        <Link
          to="/auth/login"
          className="text-primary-gold hover:text-primary-gold/80 font-medium transition-colors"
        >
          Sign in
        </Link>
      </div>
    </form>
  )
}

export default ResetPasswordForm
