import { ReactNode } from 'react'

interface BillingGuardProps {
  children: ReactNode
}

export function BillingGuard({ children }: BillingGuardProps) {
  // Billing guard disabled - allow access to all users
  // This component is kept for backward compatibility but no longer enforces billing checks
  return <>{children}</>
}
