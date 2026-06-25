import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import {
  loginSchema,
  newPasswordSchema,
  type LoginFormData,
  type NewPasswordFormData,
} from '../schemas/authSchemas'
import { useAuthStore } from '../store/authStore'
import { AuthField, AuthPasswordField, AuthButton, AuthAlert, authLinkCls } from './authUi'

const LoginForm = () => {
  const {
    login,
    completeNewPasswordChallenge,
    clearPendingChallenge,
    pendingChallenge,
    isLoading,
    error,
    clearError,
  } = useAuthStore()

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
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Set new password</h2>
          <p className="mt-1.5 text-[15px] text-ink-muted">
            You've been invited to join a team. Please choose a new password for your account.
          </p>
        </div>

        {error && <AuthAlert>{error}</AuthAlert>}

        <div className="space-y-4">
          <AuthField label="Email" type="email" value={pendingChallenge.email} disabled />

          <AuthPasswordField
            label="New password"
            placeholder="Enter your new password"
            error={newPasswordForm.formState.errors.newPassword?.message}
            {...newPasswordForm.register('newPassword')}
          />

          <AuthPasswordField
            label="Confirm password"
            placeholder="Confirm your new password"
            error={newPasswordForm.formState.errors.confirmPassword?.message}
            {...newPasswordForm.register('confirmPassword')}
          />
        </div>

        <AuthButton type="submit" fullWidth isLoading={isLoading}>
          {isLoading ? 'Setting password...' : 'Set password & sign in'}
        </AuthButton>

        <button
          type="button"
          onClick={clearPendingChallenge}
          className="w-full text-sm text-ink-muted transition-colors hover:text-ink"
        >
          Back to sign in
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={loginForm.handleSubmit(onSubmitLogin)} className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Welcome back</h2>
        <p className="mt-1.5 text-[15px] text-ink-muted">Sign in to your JobDock account</p>
      </div>

      {error && <AuthAlert>{error}</AuthAlert>}

      <div className="space-y-4">
        <AuthField
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          error={loginForm.formState.errors.email?.message}
          {...loginForm.register('email')}
        />

        <div>
          <AuthPasswordField
            label="Password"
            placeholder="Enter your password"
            autoComplete="current-password"
            error={loginForm.formState.errors.password?.message}
            {...loginForm.register('password')}
          />
          <div className="mt-2 text-right">
            <Link to="/auth/reset-password" className={`text-sm ${authLinkCls}`}>
              Forgot password?
            </Link>
          </div>
        </div>
      </div>

      <AuthButton type="submit" fullWidth isLoading={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign in'}
      </AuthButton>

      <div className="text-center text-sm text-ink-muted">
        Don't have an account?{' '}
        <Link to="/auth/signup" className={authLinkCls}>
          Sign up
        </Link>
      </div>
    </form>
  )
}

export default LoginForm
