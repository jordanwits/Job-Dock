import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { resetPasswordSchema, type ResetPasswordFormData } from '../schemas/authSchemas'
import { useAuthStore } from '../store/authStore'
import { Input, Button } from '@/components/ui'

const ResetPasswordForm = () => {
  const [isSuccess, setIsSuccess] = useState(false)
  const { resetPassword, isLoading, error, clearError } = useAuthStore()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const onSubmit = async (data: ResetPasswordFormData) => {
    clearError()
    try {
      await resetPassword(data.email)
      setIsSuccess(true)
    } catch (error) {
      // Error is handled by the store
    }
  }

  if (isSuccess) {
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
          <h2 className="text-3xl font-bold text-primary-light mb-2">
            Check your email
          </h2>
          <p className="text-primary-light/70">
            We've sent a password reset link to your email address. Please check
            your inbox and follow the instructions.
          </p>
        </div>

        <div className="text-center">
          <Link
            to="/auth/login"
            className="text-primary-gold hover:text-primary-gold/80 font-medium transition-colors"
          >
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-primary-light mb-2">
          Reset password
        </h2>
        <p className="text-primary-light/70">
          Enter your email address and we'll send you a link to reset your password.
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
        error={errors.email?.message}
        {...register('email')}
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

