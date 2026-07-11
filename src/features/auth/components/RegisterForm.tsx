import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { registerSchema, type RegisterFormData } from '../schemas/authSchemas'
import { useAuthStore } from '../store/authStore'
import { AuthField, AuthPasswordField, AuthButton, AuthAlert, authLinkCls } from './authUi'

const RegisterForm = () => {
  const navigate = useNavigate()
  const { register: registerUser, isLoading, error, clearError } = useAuthStore()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    clearError()
    try {
      await registerUser({
        email: data.email,
        password: data.password,
        name: data.name,
        companyName: data.companyName,
      })
      navigate('/app')
    } catch (error) {
      // Error is handled by the store
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Create account</h2>
        <p className="mt-1.5 text-[15px] text-ink-muted">Get started with CleanDock today</p>
      </div>

      {error && <AuthAlert>{error}</AuthAlert>}

      <div className="space-y-4">
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
          placeholder="you@example.com"
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
      </div>

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
  )
}

export default RegisterForm
