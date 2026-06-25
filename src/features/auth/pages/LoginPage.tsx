import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import LoginForm from '../components/LoginForm'
import { AuthShell, AuthCard, AuthAlert } from '../components/authUi'

const LoginPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated } = useAuthStore()
  const [sessionMessage, setSessionMessage] = useState<string | null>(null)
  const [isFromCheckout, setIsFromCheckout] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app')
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    // Check for return from Stripe checkout (new signup)
    const fromCheckout = searchParams.get('from_checkout')
    if (fromCheckout === '1') {
      setSessionMessage('Account created! Enter your password below to log in.')
      setIsFromCheckout(true)
      window.history.replaceState({}, '', '/auth/login')
      return
    }

    // Check for session timeout message
    const sessionExpired = searchParams.get('session')
    const message = searchParams.get('message')

    if (sessionExpired === 'expired' && message) {
      setSessionMessage(decodeURIComponent(message))

      // Auto-clear message after 10 seconds
      const timeout = setTimeout(() => {
        setSessionMessage(null)
      }, 10000)

      return () => clearTimeout(timeout)
    }
  }, [searchParams])

  return (
    <AuthShell>
      {sessionMessage && (
        <div className="mb-4">
          <AuthAlert
            tone={isFromCheckout ? 'success' : 'warning'}
            onDismiss={() => setSessionMessage(null)}
          >
            {sessionMessage}
          </AuthAlert>
        </div>
      )}

      <AuthCard>
        <LoginForm />
      </AuthCard>
    </AuthShell>
  )
}

export default LoginPage
