import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import RegisterForm from '../components/RegisterForm'

const RegisterPage = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app')
    }
  }, [isAuthenticated, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-dark p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-primary-gold mb-2">JobDock</h1>
          <p className="text-primary-light/70">Contractor Management Platform</p>
        </div>

        <div className="bg-primary-dark-secondary rounded-lg border border-primary-blue p-8 shadow-xl">
          <RegisterForm />
        </div>
      </div>
    </div>
  )
}

export default RegisterPage

