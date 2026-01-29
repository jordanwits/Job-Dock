import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { loginSchema, type LoginFormData } from '../schemas/authSchemas'
import { useAuthStore } from '../store/authStore'
import { Input, PasswordInput, Button } from '@/components/ui'

const LoginForm = () => {
  const { login, isLoading, error, clearError } = useAuthStore()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    clearError()
    try {
      await login(data.email, data.password)
    } catch (error) {
      // Error is handled by the store
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
          error={errors.email?.message}
          {...register('email')}
        />

        <div>
          <PasswordInput
            label="Password"
            placeholder="Enter your password"
            error={errors.password?.message}
            {...register('password')}
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
