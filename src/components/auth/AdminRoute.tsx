import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

export interface AdminRouteProps {
  children: ReactNode
  userRole?: string
}

/**
 * Redirects employees to job-logs except when on allowed paths (dashboard, calendar, job logs).
 * Treats undefined role as admin to avoid locking out users with stale auth state.
 */
const AdminRoute = ({ children, userRole }: AdminRouteProps) => {
  const location = useLocation()
  const pathname = location.pathname

  if (userRole === 'employee') {
    const isAllowed =
      pathname === '/app' ||
      pathname.startsWith('/app/scheduling') ||
      pathname.startsWith('/app/job-logs')
    if (!isAllowed) {
      return <Navigate to="/app/job-logs" replace />
    }
  }

  return <>{children}</>
}

export default AdminRoute
