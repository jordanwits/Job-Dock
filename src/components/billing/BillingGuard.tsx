import { ReactNode, useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { billingService } from '@/lib/api/services'
import { useAuthStore } from '@/features/auth'

interface BillingGuardProps {
  children: ReactNode
}

export function BillingGuard({ children }: BillingGuardProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const [checking, setChecking] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    // Skip billing check for billing pages themselves
    if (location.pathname.startsWith('/app/billing')) {
      setHasAccess(true)
      setChecking(false)
      return
    }

    // Only check for tenant owners
    // Non-owners can use the app regardless of billing status
    const checkBillingStatus = async () => {
      try {
        const status = await billingService.getStatus()
        const isActive = status.status === 'active' || status.status === 'trialing'
        
        if (!isActive && user?.role === 'owner') {
          // Redirect owner to billing page if subscription not active
          navigate('/app/billing', { replace: true })
          return
        }
        
        setHasAccess(true)
      } catch (err) {
        console.error('Failed to check billing status:', err)
        // On error, allow access (fail open to prevent lockout)
        setHasAccess(true)
      } finally {
        setChecking(false)
      }
    }

    checkBillingStatus()
  }, [location.pathname, navigate, user?.role])

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking access...</p>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return null // Redirecting...
  }

  return <>{children}</>
}
