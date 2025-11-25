import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { registerSchema, type RegisterFormData } from '../schemas/authSchemas'
import { useAuthStore } from '../store/authStore'
import { Input, PasswordInput, Button } from '@/components/ui'

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
      navigate('/')
    } catch (error) {
      // Error is handled by the store
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-primary-light mb-2">Create account</h2>
        <p className="text-primary-light/70">Get started with JobDock today</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500 p-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <Input
          label="Full Name"
          type="text"
          placeholder="John Doe"
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Company Name"
          type="text"
          placeholder="Your Company Inc."
          error={errors.companyName?.message}
          {...register('companyName')}
        />

        <PasswordInput
          label="Password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          helperText="Must be at least 8 characters"
          {...register('password')}
        />

        <PasswordInput
          label="Confirm Password"
          placeholder="Confirm your password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Creating account...' : 'Create account'}
      </Button>

      <div className="text-center text-sm text-primary-light/70">
        Already have an account?{' '}
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

export default RegisterForm

