import { useState, useEffect } from 'react'
import { Button, Card } from '@/components/ui'
import { services } from '@/lib/api/services'
import { cn } from '@/lib/utils'

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

type PlanTier = 'single' | 'team'

interface Plan {
  id: PlanTier
  name: string
  description: string
  features: string[]
  price?: string
}

const PLANS: Plan[] = [
  {
    id: 'single',
    name: 'Single',
    description: 'Perfect for solo operators',
    features: [
      'Unlimited jobs and contacts',
      'Invoice and quote generation',
      'Time tracking',
      'Photo capture',
      'Calendar scheduling',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    description: 'Collaborate with your team',
    features: [
      'Everything in Single',
      'Invite team members',
      'Team time tracking',
      'Shared calendar',
      'Role-based permissions',
    ],
  },
]

export const BillingSection = () => {
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)
  const [manageLoading, setManageLoading] = useState(false)
  const [changingPlan, setChangingPlan] = useState<PlanTier | null>(null)

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

  const handleChangePlan = async (newPlan: PlanTier) => {
    const currentTier = status?.subscriptionTier || 'single'
    
    if (newPlan === currentTier) {
      return // Already on this plan
    }

    // Check if downgrading and if allowed
    if (currentTier === 'team' && newPlan === 'single') {
      if (!status?.canDowngrade) {
        alert('You must remove team members before downgrading to Single plan.')
        return
      }
    }

    setChangingPlan(newPlan)
    
    // TODO: Integrate with Stripe when configured
    // For now, just show a message
    setTimeout(() => {
      alert(`Plan change to ${newPlan === 'team' ? 'Team' : 'Single'} will be processed once Stripe is configured.`)
      setChangingPlan(null)
    }, 500)
  }

  if (loading || !status) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-primary-light">Billing & Subscription</h2>
        <div className="h-20 bg-primary-dark rounded-lg animate-pulse" />
      </div>
    )
  }

  const tier = status.subscriptionTier || 'single'
  const isTeam = tier === 'team'
  const hasActiveSubscription =
    status.status === 'active' || status.status === 'trialing'

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-primary-light">Billing & Subscription</h2>
      
      {/* Current Plan Status */}
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1">
              <p className="text-primary-light font-medium">
                Current plan: <span className="text-primary-gold">{isTeam ? 'Team' : 'Single'}</span>
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
            {hasActiveSubscription && (
              <Button
                variant="secondary"
                onClick={handleManageBilling}
                disabled={manageLoading}
                className="w-full sm:w-auto"
              >
                {manageLoading ? 'Opening...' : 'Manage billing'}
              </Button>
            )}
          </div>
        </Card>

        {/* Plan Selection */}
        <div>
          <h3 className="text-lg font-medium text-primary-light mb-4">Change Subscription Plan</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {PLANS.map((plan) => {
              const isCurrentPlan = tier === plan.id
              const isChanging = changingPlan === plan.id
              const canSelect = hasActiveSubscription && (
                plan.id === 'team' || (plan.id === 'single' && status.canDowngrade)
              )

              return (
                <Card
                  key={plan.id}
                  className={cn(
                    'p-6 relative',
                    isCurrentPlan && 'ring-2 ring-primary-gold border-primary-gold'
                  )}
                >
                  {isCurrentPlan && (
                    <div className="absolute top-4 right-4">
                      <span className="px-2 py-1 text-xs font-medium bg-primary-gold text-primary-dark rounded">
                        Current
                      </span>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xl font-semibold text-primary-light">{plan.name}</h4>
                      <p className="text-sm text-primary-light/70 mt-1">{plan.description}</p>
                    </div>

                    <ul className="space-y-2">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start text-sm text-primary-light/80">
                          <svg
                            className="w-5 h-5 text-primary-gold mr-2 flex-shrink-0 mt-0.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="pt-4">
                      {isCurrentPlan ? (
                        <Button variant="secondary" disabled className="w-full">
                          Current Plan
                        </Button>
                      ) : !hasActiveSubscription ? (
                        <Button variant="secondary" disabled className="w-full">
                          Subscribe to change plans
                        </Button>
                      ) : !canSelect ? (
                        <Button variant="secondary" disabled className="w-full">
                          {plan.id === 'single' ? 'Remove team members first' : 'Unavailable'}
                        </Button>
                      ) : (
                        <Button
                          variant={plan.id === 'team' ? 'primary' : 'outline'}
                          onClick={() => handleChangePlan(plan.id)}
                          disabled={isChanging || changingPlan !== null}
                          className="w-full"
                        >
                          {isChanging
                            ? 'Processing...'
                            : plan.id === 'team'
                            ? 'Upgrade to Team'
                            : 'Downgrade to Single'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
