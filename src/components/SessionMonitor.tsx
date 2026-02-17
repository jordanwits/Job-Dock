/**
 * Session Monitor Component
 * 
 * Automatically refreshes JWT tokens before expiration to maintain seamless sessions
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store/authStore'
import { getTokenTimeRemaining } from '@/lib/utils/tokenUtils'

const SessionMonitor = () => {
  const navigate = useNavigate()
  const { isAuthenticated, checkTokenValidity, clearSession, refreshAccessToken } = useAuthStore()
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    // Check token validity and auto-refresh every 30 seconds
    const checkInterval = setInterval(async () => {
      const token = localStorage.getItem('auth_token')
      
      if (!token) {
        clearSession()
        navigate('/auth/login?session=expired&message=' + encodeURIComponent('Your session has expired.'))
        return
      }

      const remaining = getTokenTimeRemaining(token)

      // Auto-refresh token when less than 5 minutes remaining
      if (remaining > 0 && remaining <= 300 && !isRefreshing) {
        console.log(`Token expiring in ${remaining}s, refreshing automatically...`)
        setIsRefreshing(true)
        
        try {
          const success = await refreshAccessToken()
          if (success) {
            console.log('Token refreshed successfully')
          } else {
            console.warn('Token refresh failed, redirecting to login')
            navigate('/auth/login?session=expired&message=' + encodeURIComponent('Your session has expired. Please log in again.'))
          }
        } catch (error) {
          console.error('Error refreshing token:', error)
          clearSession()
          navigate('/auth/login?session=expired&message=' + encodeURIComponent('Your session has expired. Please log in again.'))
        } finally {
          setIsRefreshing(false)
        }
        return
      }

      // If token is already expired, clear session and redirect
      if (!checkTokenValidity()) {
        clearSession()
        navigate('/auth/login?session=expired&message=' + encodeURIComponent('Your session has expired. Please log in again.'))
      }
    }, 30000) // Check every 30 seconds

    // Also check immediately on mount (and pull latest user/permissions)
    const initialCheck = async () => {
      const token = localStorage.getItem('auth_token')
      // Always try a refresh once on mount so role/permission changes take effect
      // without requiring logout or waiting for expiry.
      if (token) {
        try {
          await refreshAccessToken()
        } catch (error) {
          console.error('Initial token refresh failed:', error)
        }
      }
      checkTokenValidity()
    }
    
    initialCheck()

    return () => clearInterval(checkInterval)
  }, [isAuthenticated, checkTokenValidity, clearSession, refreshAccessToken, navigate, isRefreshing])

  // No UI needed - everything happens in the background
  return null
}

export default SessionMonitor
