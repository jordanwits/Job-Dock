import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuthStore } from '../store/authStore'
import { completeSignupSchema, type CompleteSignupFormData } from '../schemas/authSchemas'
import { Input, PasswordInput, Button } from '@/components/ui'
import MarketingLayout from '@/features/marketing/components/MarketingLayout'
import { authService } from '@/lib/api/services'
import { getErrorMessage } from '@/lib/utils/errorHandler'

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
      <MarketingLayout>
        <div className="container mx-auto px-4 md:px-6 pt-24 md:pt-32 pb-12">
          <div className="max-w-md mx-auto text-center">
            <p className="text-primary-dark/70">Verifying your checkout…</p>
          </div>
        </div>
      </MarketingLayout>
    )
  }

  if (sessionError || !sessionEmail) {
    return (
      <MarketingLayout>
        <div className="container mx-auto px-4 md:px-6 pt-24 md:pt-32 pb-12">
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg border border-primary-blue/10 p-8">
            <p className="text-red-600 mb-4">{sessionError || 'Invalid session'}</p>
            <Link to="/auth/signup" className="text-primary-gold hover:text-primary-gold/80 font-medium">
              ← Back to signup
            </Link>
          </div>
        </div>
      </MarketingLayout>
    )
  }

  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 md:px-6 pt-24 md:pt-32 pb-12 md:pb-16">
        <div className="max-w-md mx-auto">
          <div className="mb-10 text-center space-y-2">
            <h1 className="text-4xl font-bold text-primary-gold">JobDock</h1>
            <p className="text-primary-dark/70">Contractor Management Platform</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-primary-blue/10 p-8 md:p-10">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-primary-dark mb-2">Create your account</h2>
              <p className="text-primary-dark/70">You’ve completed payment. Finish setting up your account.</p>
            </div>

            {error && (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <Input
                label="Email"
                type="email"
                value={sessionEmail}
                readOnly
                themeOverride="light"
              />
              <Input
                label="Full Name"
                type="text"
                placeholder="John Doe"
                error={errors.name?.message}
                themeOverride="light"
                {...register('name')}
              />
              <Input
                label="Company Name"
                type="text"
                placeholder="Your Company Inc."
                error={errors.companyName?.message}
                themeOverride="light"
                {...register('companyName')}
              />
              <PasswordInput
                label="Password"
                placeholder="Enter a strong password"
                error={errors.password?.message}
                helperText="Must be at least 12 characters with uppercase, lowercase, number, and special character (!@#$%^&*)"
                themeOverride="light"
                {...register('password')}
              />
              <PasswordInput
                label="Confirm Password"
                placeholder="Confirm your password"
                error={errors.confirmPassword?.message}
                themeOverride="light"
                {...register('confirmPassword')}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Creating account...' : 'Complete signup'}
              </Button>

              <div className="text-center text-sm text-primary-dark/70">
                Already have an account?{' '}
                <Link to="/auth/login" className="text-primary-gold hover:text-primary-gold/80 font-medium transition-colors">
                  Sign in
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </MarketingLayout>
  )
}

export default SignupCompletePage
