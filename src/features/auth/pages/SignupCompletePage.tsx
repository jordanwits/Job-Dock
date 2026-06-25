import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuthStore } from '../store/authStore'
import { completeSignupSchema, type CompleteSignupFormData } from '../schemas/authSchemas'
import { authService } from '@/lib/api/services'
import { getErrorMessage } from '@/lib/utils/errorHandler'
import {
  AuthShell,
  AuthCard,
  AuthField,
  AuthPasswordField,
  AuthButton,
  AuthAlert,
  authLinkCls,
} from '../components/authUi'

const SignupCompletePage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const { completeSignup, isAuthenticated, isLoading, error, clearError } = useAuthStore()
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [fetchingSession, setFetchingSession] = useState(true)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app')
      return
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    if (!sessionId) {
      setSessionError('Missing session. Please complete checkout first.')
      setFetchingSession(false)
      return
    }
    let cancelled = false
    authService
      .getSignupSession(sessionId)
      .then(res => {
        if (!cancelled) {
          setSessionEmail(res.email)
          setSessionError(null)
        }
      })
      .catch(e => {
        if (!cancelled) {
          setSessionError(getErrorMessage(e, 'Could not verify checkout session. Please try again.'))
        }
      })
      .finally(() => {
        if (!cancelled) setFetchingSession(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompleteSignupFormData>({
    resolver: zodResolver(completeSignupSchema),
  })

  const onSubmit = async (data: CompleteSignupFormData) => {
    if (!sessionId || !sessionEmail) return
    clearError()
    try {
      await completeSignup({
        session_id: sessionId,
        name: data.name,
        companyName: data.companyName,
        password: data.password,
      })
      navigate('/app')
    } catch {
      // Error handled by store
    }
  }

  if (fetchingSession) {
    return (
      <AuthShell>
        <AuthCard className="text-center">
          <p className="text-[15px] text-ink-muted">Verifying your checkout…</p>
        </AuthCard>
      </AuthShell>
    )
  }

  if (sessionError || !sessionEmail) {
    return (
      <AuthShell>
        <AuthCard className="space-y-5">
          <AuthAlert>{sessionError || 'Invalid session'}</AuthAlert>
          <Link to="/auth/signup" className={authLinkCls}>
            ← Back to signup
          </Link>
        </AuthCard>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <AuthCard>
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Create your account</h2>
          <p className="mt-1.5 text-[15px] text-ink-muted">
            You've completed payment. Finish setting up your account.
          </p>
        </div>

        {error && (
          <div className="mb-6">
            <AuthAlert>{error}</AuthAlert>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <AuthField label="Email" type="email" value={sessionEmail} readOnly />
          <AuthField
            label="Full Name"
            type="text"
            placeholder="John Doe"
            error={errors.name?.message}
            {...register('name')}
          />
          <AuthField
            label="Company Name"
            type="text"
            placeholder="Your Company Inc."
            error={errors.companyName?.message}
            {...register('companyName')}
          />
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
            {isLoading ? 'Creating account...' : 'Complete signup'}
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

export default SignupCompletePage
