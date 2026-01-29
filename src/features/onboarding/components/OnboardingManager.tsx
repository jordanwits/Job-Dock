import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'

/**
 * OnboardingManager redirects first-time users to the onboarding flow
 * Mounted inside BrowserRouter in App.tsx
 */
export const OnboardingManager = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated } = useAuthStore()

  useEffect(() => {
    // Only redirect if:
    // 1. User is authenticated
    // 2. Currently on an /app route
    // 3. Not already on /app/onboarding
    // 4. User hasn't completed onboarding
    if (
      isAuthenticated &&
      user &&
      !user.onboardingCompletedAt &&
      location.pathname.startsWith('/app') &&
      location.pathname !== '/app/onboarding'
    ) {
      navigate('/app/onboarding', { replace: true })
    }
  }, [isAuthenticated, user, location.pathname, navigate])

  return null
}
