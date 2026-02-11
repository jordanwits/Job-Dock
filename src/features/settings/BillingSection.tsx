import { useState, useEffect } from 'react'
import { Button } from '@/components/ui'
import { CollapsibleSection } from './CollapsibleSection'
import { services } from '@/lib/api/services'

interface BillingStatus {
  hasSubscription: boolean
  status: string
  trialEndsAt: string | null
  currentPeriodEndsAt: string | null
  cancelAtPeriodEnd: boolean
  subscriptionTier?: string
  canInviteTeamMembers?: boolean
  canDowngrade?: boolean
  teamMemberCount?: number
}

export const BillingSection = () => {
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)
  const [manageLoading, setManageLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await services.billing.getStatus()
        setStatus(data)
      } catch (err) {
        console.error('Failed to load billing status:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleUpgradeToTeam = async () => {
    try {
      setUpgrading(true)
      const { url } = await services.billing.createUpgradeCheckoutUrl('team')
      if (url) {
        window.location.href = url
      }
    } catch (err: any) {
      console.error('Upgrade failed:', err)
      alert(err.response?.data?.message || 'Failed to start upgrade')
    } finally {
      setUpgrading(false)
    }
  }

  const handleManageBilling = async () => {
    try {
      setManageLoading(true)
      const { url } = await services.billing.createPortalSession()
      if (url) {
        window.location.href = url
      }
    } catch (err: any) {
      console.error('Failed to open billing portal:', err)
      alert(err.response?.data?.message || 'Failed to open billing portal')
    } finally {
      setManageLoading(false)
    }
  }

  if (loading || !status) {
    return (
      <CollapsibleSection title="Billing & Subscription" defaultCollapsed={false}>
        <div className="h-20 bg-primary-dark rounded-lg animate-pulse" />
      </CollapsibleSection>
    )
  }

  const tier = status.subscriptionTier || 'single'
  const isTeam = tier === 'team'
  const hasActiveSubscription =
    status.status === 'active' || status.status === 'trialing'

  return (
    <CollapsibleSection title="Billing & Subscription" defaultCollapsed={false}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-primary-light font-medium">
              Current plan: {isTeam ? 'Team' : 'Single'}
            </p>
            <p className="text-sm text-primary-light/60 mt-1">
              {hasActiveSubscription
                ? isTeam
                  ? `You can invite team members.${status.teamMemberCount != null ? ` (${status.teamMemberCount} member${status.teamMemberCount !== 1 ? 's' : ''})` : ''}`
                  : 'Upgrade to Team to invite team members.'
                : 'No active subscription.'}
            </p>
            {isTeam && !status.canDowngrade && status.teamMemberCount != null && status.teamMemberCount > 1 && (
              <p className="text-sm text-amber-400/90 mt-1">
                Remove team members before downgrading to Single plan.
              </p>
            )}
          </div>
        </div>

        {hasActiveSubscription && (
          <Button
            variant="secondary"
            onClick={handleManageBilling}
            disabled={manageLoading}
          >
            {manageLoading ? 'Opening...' : 'Manage billing'}
          </Button>
        )}

        {!isTeam && hasActiveSubscription && (
          <Button
            variant="primary"
            onClick={handleUpgradeToTeam}
            disabled={upgrading}
          >
            {upgrading ? 'Loading...' : 'Upgrade to Team'}
          </Button>
        )}
      </div>
    </CollapsibleSection>
  )
}
