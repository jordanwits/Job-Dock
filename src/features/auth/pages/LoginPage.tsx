import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import LoginForm from '../components/LoginForm'

const LoginPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated } = useAuthStore()
  const [sessionMessage, setSessionMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app')
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
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
    <div className="min-h-screen flex items-center justify-center bg-primary-dark p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center space-y-1">
          <h1 className="text-4xl font-bold text-primary-gold">JobDock</h1>
          <p className="text-primary-light/60">Contractor Management Platform</p>
        </div>

        {sessionMessage && (
          <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/30 ring-1 ring-amber-500/20 p-4">
            <div className="flex items-start">
              <svg
                className="h-5 w-5 text-amber-400 mt-0.5 mr-3 flex-shrink-0"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-amber-400 font-medium">{sessionMessage}</p>
              </div>
              <button
                onClick={() => setSessionMessage(null)}
                className="text-amber-400 hover:text-amber-300 ml-3 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="bg-primary-dark-secondary rounded-xl border border-white/10 p-8 shadow-lg shadow-black/30">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}

export default LoginPage
