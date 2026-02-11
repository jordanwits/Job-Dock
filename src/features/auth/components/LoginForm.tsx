import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { loginSchema, newPasswordSchema, type LoginFormData, type NewPasswordFormData } from '../schemas/authSchemas'
import { useAuthStore } from '../store/authStore'
import { Input, PasswordInput, Button } from '@/components/ui'

const LoginForm = () => {
  const { login, completeNewPasswordChallenge, clearPendingChallenge, pendingChallenge, isLoading, error, clearError } =
    useAuthStore()

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const newPasswordForm = useForm<NewPasswordFormData>({
    resolver: zodResolver(newPasswordSchema),
  })

  const onSubmitLogin = async (data: LoginFormData) => {
    clearError()
    try {
      const loginPromise = login(data.email, data.password)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Login request timed out. Please check your connection and try again.'))
        }, 35000)
      })
      await Promise.race([loginPromise, timeoutPromise])
    } catch (error: any) {
      console.error('Login form error:', error)
    }
  }

  const onSubmitNewPassword = async (data: NewPasswordFormData) => {
    clearError()
    try {
      await completeNewPasswordChallenge(data.newPassword)
    } catch (error: any) {
      console.error('New password form error:', error)
    }
  }

  if (pendingChallenge) {
    return (
      <form onSubmit={newPasswordForm.handleSubmit(onSubmitNewPassword)} className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-primary-light mb-2">Set new password</h2>
          <p className="text-primary-light/70">
            You've been invited to join a team. Please choose a new password for your account.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500 p-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={pendingChallenge.email}
            disabled
            className="bg-primary-dark/50"
          />

          <PasswordInput
            label="New password"
            placeholder="Enter your new password"
            error={newPasswordForm.formState.errors.newPassword?.message}
            {...newPasswordForm.register('newPassword')}
          />

          <PasswordInput
            label="Confirm password"
            placeholder="Confirm your new password"
            error={newPasswordForm.formState.errors.confirmPassword?.message}
            {...newPasswordForm.register('confirmPassword')}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Setting password...' : 'Set password & sign in'}
        </Button>

        <button
          type="button"
          onClick={clearPendingChallenge}
          className="w-full text-sm text-primary-light/70 hover:text-primary-light transition-colors"
        >
          Back to sign in
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={loginForm.handleSubmit(onSubmitLogin)} className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-primary-light mb-2">Welcome back</h2>
        <p className="text-primary-light/70">Sign in to your JobDock account</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500 p-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          error={loginForm.formState.errors.email?.message}
          {...loginForm.register('email')}
        />

        <div>
          <PasswordInput
            label="Password"
            placeholder="Enter your password"
            error={loginForm.formState.errors.password?.message}
            {...loginForm.register('password')}
          />
          <div className="mt-2 text-right">
            <Link
              to="/auth/reset-password"
              className="text-sm text-primary-blue hover:text-primary-gold transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign in'}
      </Button>

      <div className="text-center text-sm text-primary-light/70">
        Don't have an account?{' '}
        <Link
          to="/request-access"
          className="text-primary-gold hover:text-primary-gold/80 font-medium transition-colors"
        >
          Request access
        </Link>
      </div>
    </form>
  )
}

export default LoginForm
