import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

export interface ProtectedRouteProps {
  children: ReactNode
  isAuthenticated: boolean
  redirectTo?: string
}

const ProtectedRoute = ({
  children,
  isAuthenticated,
  redirectTo = '/auth/login',
}: ProtectedRouteProps) => {
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute

