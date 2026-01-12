/**
 * Session Monitor Component
 * 
 * Monitors JWT token expiration and warns users before session timeout
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store/authStore'
import { getTokenTimeRemaining } from '@/lib/utils/tokenUtils'

const SessionMonitor = () => {
  const navigate = useNavigate()
  const { isAuthenticated, checkTokenValidity, clearSession } = useAuthStore()
  const [showWarning, setShowWarning] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    // Check token validity every 30 seconds
    const checkInterval = setInterval(() => {
      const token = localStorage.getItem('auth_token')
      
      if (!token) {
        clearSession()
        navigate('/auth/login?session=expired&message=' + encodeURIComponent('Your session has expired.'))
        return
      }

      const remaining = getTokenTimeRemaining(token)
      setTimeRemaining(remaining)

      // Show warning if less than 5 minutes remaining
      if (remaining > 0 && remaining <= 300) {
        setShowWarning(true)
      } else {
        setShowWarning(false)
      }

      // If token is expired, clear session and redirect
      if (!checkTokenValidity()) {
        clearSession()
        navigate('/auth/login?session=expired&message=' + encodeURIComponent('Your session has expired. Please log in again.'))
      }
    }, 30000) // Check every 30 seconds

    // Also check immediately on mount
    checkTokenValidity()

    return () => clearInterval(checkInterval)
  }, [isAuthenticated, checkTokenValidity, clearSession, navigate])

  // Don't show anything if not authenticated or no warning needed
  if (!isAuthenticated || !showWarning || timeRemaining <= 0) {
    return null
  }

  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="rounded-lg bg-amber-500/10 border border-amber-500 p-4 shadow-lg">
        <div className="flex items-start">
          <svg
            className="h-5 w-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-500">Session Expiring Soon</p>
            <p className="text-xs text-amber-500/80 mt-1">
              Your session will expire in {minutes}m {seconds}s. Save your work and refresh the page to extend your session.
            </p>
          </div>
          <button
            onClick={() => setShowWarning(false)}
            className="text-amber-500 hover:text-amber-400 ml-3"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default SessionMonitor
