/**
 * Session Monitor Component
 * 
 * Automatically refreshes JWT tokens before expiration to maintain seamless sessions
 */

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store/authStore'
import { getTokenTimeRemaining } from '@/lib/utils/tokenUtils'
import { appEnv } from '@/lib/env'

const SessionMonitor = () => {
  const navigate = useNavigate()
  const { isAuthenticated, checkTokenValidity, clearSession, refreshAccessToken } = useAuthStore()
  // A ref (not state) so that toggling it does NOT re-run the effect below — otherwise the
  // 30s interval would tear down and rebuild (and re-run the on-mount refresh) on every refresh.
  const isRefreshingRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    // In mock data mode there is no real backend to refresh against and the
    // mock token isn't a real JWT, so the refresh/expiry machinery would
    // immediately 401 and clear the session. Keep mock sessions alive.
    if (appEnv.isMock) {
      return
    }

    const runTokenCheck = async () => {
      const token = localStorage.getItem('auth_token')

      if (!token) {
        clearSession()
        navigate('/auth/login?session=expired&message=' + encodeURIComponent('Your session has expired.'))
        return
      }

      const remaining = getTokenTimeRemaining(token)

      // Auto-refresh token when less than 5 minutes remaining
      if (remaining > 0 && remaining <= 300 && !isRefreshingRef.current) {
        console.log(`Token expiring in ${remaining}s, refreshing automatically...`)
        isRefreshingRef.current = true

        try {
          const success = await refreshAccessToken()
          if (success) {
            console.log('Token refreshed successfully')
          } else {
            console.warn('Token refresh failed, redirecting to login')
            navigate(
              '/auth/login?session=expired&message=' +
                encodeURIComponent('Your session has expired. Please log in again.')
            )
          }
        } catch (error) {
          console.error('Error refreshing token:', error)
          clearSession()
          navigate(
            '/auth/login?session=expired&message=' +
              encodeURIComponent('Your session has expired. Please log in again.')
          )
        } finally {
          isRefreshingRef.current = false
        }
        return
      }

      // If token is already expired, clear session and redirect
      if (!checkTokenValidity()) {
        clearSession()
        navigate(
          '/auth/login?session=expired&message=' +
            encodeURIComponent('Your session has expired. Please log in again.')
        )
      }
    }

    // Check token validity and auto-refresh every 30 seconds
    const checkInterval = setInterval(async () => {
      await runTokenCheck()
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

    // Also run on "resume-like" events (important for mobile/webview where intervals pause)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runTokenCheck()
      }
    }
    const handleFocus = () => {
      void runTokenCheck()
    }
    const handlePageShow = () => {
      void runTokenCheck()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      clearInterval(checkInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [isAuthenticated, checkTokenValidity, clearSession, refreshAccessToken, navigate])

  // No UI needed - everything happens in the background
  return null
}

export default SessionMonitor
