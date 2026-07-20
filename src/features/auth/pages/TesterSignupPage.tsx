import { useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuthStore } from '../store/authStore'
import { testerSignupSchema, type TesterSignupFormData } from '../schemas/authSchemas'
import {
  AuthShell,
  AuthCard,
  AuthField,
  AuthPasswordField,
  AuthButton,
  AuthAlert,
  authLinkCls,
} from '../components/authUi'

/**
 * Self-service beta-tester signup — no Stripe, no credit card.
 *
 * Gated by a shared tester code. The code can be prefilled from an invite link
 * (`/auth/tester?code=…`), in which case the field is hidden; otherwise the tester types it.
 * On success the account is created directly (comped Team trial) and the tester is logged in.
 */
const TesterSignupPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const codeParam = searchParams.get('code') || ''
  const invited = codeParam.length > 0
  const { testerSignup, isAuthenticated, isLoading, error, clearError } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app')
    }
  }, [isAuthenticated, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TesterSignupFormData>({
    resolver: zodResolver(testerSignupSchema),
    defaultValues: { code: codeParam },
  })

  const onSubmit = async (data: TesterSignupFormData) => {
    clearError()
    try {
      await testerSignup({
        email: data.email,
        name: data.name,
        companyName: data.companyName,
        password: data.password,
        code: data.code,
      })
      navigate('/app')
    } catch {
      // Error handled by store
    }
  }

  return (
    <AuthShell>
      <AuthCard>
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Beta tester signup</h2>
          <p className="mt-1.5 text-[15px] text-ink-muted">
            Full access, free — no credit card required.
          </p>
        </div>

        {error && (
          <div className="mb-6">
            <AuthAlert>{error}</AuthAlert>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <AuthField
            label="Full Name"
            type="text"
            placeholder="John Doe"
            error={errors.name?.message}
            {...register('name')}
          />
          <AuthField
            label="Email"
            type="email"
            placeholder="you@company.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <AuthField
            label="Company Name"
            type="text"
            placeholder="Your Company Inc."
            error={errors.companyName?.message}
            {...register('companyName')}
          />
          {invited ? (
            <input type="hidden" {...register('code')} />
          ) : (
            <AuthField
              label="Tester Code"
              type="text"
              placeholder="Enter your tester code"
              error={errors.code?.message}
              {...register('code')}
            />
          )}
          <AuthPasswordField
            label="Password"
            placeholder="Enter a strong password"
            error={errors.password?.message}
            helperText="Must be at least 12 characters with uppercase, lowercase, number, and special character (!@#$%^&*)"
            {...register('password')}
          />
          <AuthPasswordField
            label="Confirm Password"
            placeholder="Confirm your password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <AuthButton type="submit" fullWidth isLoading={isLoading}>
            {isLoading ? 'Creating account...' : 'Create account'}
          </AuthButton>

          <div className="text-center text-sm text-ink-muted">
            Already have an account?{' '}
            <Link to="/auth/login" className={authLinkCls}>
              Sign in
            </Link>
          </div>
        </form>
      </AuthCard>
    </AuthShell>
  )
}

export default TesterSignupPage
