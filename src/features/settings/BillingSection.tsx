import { useState, useEffect } from 'react'
import { Button, Card, Modal } from '@/components/ui'
import { services } from '@/lib/api/services'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

interface BillingStatus {
  hasSubscription: boolean
  status: string
  trialEndsAt: string | null
  currentPeriodEndsAt: string | null
  cancelAtPeriodEnd: boolean
  deleteAccountAtPeriodEnd?: boolean
  subscriptionTier?: string
  canInviteTeamMembers?: boolean
  canDowngrade?: boolean
  teamMemberCount?: number
}

const CANCEL_CONFIRM_PHRASE = 'cancel my account'

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
  const { theme } = useTheme()
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)
  const [manageLoading, setManageLoading] = useState(false)
  const [changingPlan, setChangingPlan] = useState<PlanTier | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelConfirmText, setCancelConfirmText] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)

  const loadStatus = async () => {
    try {
      const data = await services.billing.getStatus()
      setStatus(data)
    } catch (err) {
      console.error('Failed to load billing status:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const handleCancelAndScheduleDeletion = async () => {
    if (cancelConfirmText.toLowerCase().trim() !== CANCEL_CONFIRM_PHRASE) {
      alert(`Please type "${CANCEL_CONFIRM_PHRASE}" exactly to confirm.`)
      return
    }
    try {
      setCancelLoading(true)
      await services.billing.cancelAndScheduleDeletion()
      await loadStatus()
      setShowCancelModal(false)
      setCancelConfirmText('')
    } catch (err: any) {
      console.error('Failed to cancel:', err)
      alert(err.response?.data?.message || 'Failed to cancel. Please try again.')
    } finally {
      setCancelLoading(false)
    }
  }

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
        <h2 className={cn(
          "text-xl font-semibold",
          theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
        )}>Billing & Subscription</h2>
        <div className={cn(
          "h-20 rounded-lg animate-pulse",
          theme === 'dark' ? 'bg-primary-dark' : 'bg-gray-200'
        )} />
      </div>
    )
  }

  const tier = status.subscriptionTier || 'single'
  const isTeam = tier === 'team'
  const hasActiveSubscription =
    status.status === 'active' || status.status === 'trialing'

  return (
    <div className="space-y-6">
      <h2 className={cn(
        "text-xl font-semibold",
        theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
      )}>Billing & Subscription</h2>
      
      {/* Current Plan Status */}
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1">
              <p className={cn(
                "font-medium",
                theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
              )}>
                Current plan: <span className="text-primary-gold">{isTeam ? 'Team' : 'Single'}</span>
              </p>
              <p className={cn(
                "text-sm mt-1",
                theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
              )}>
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
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={handleManageBilling}
                  disabled={manageLoading}
                  className="w-full sm:w-auto"
                >
                  {manageLoading ? 'Opening...' : 'Manage billing'}
                </Button>
                {!status.deleteAccountAtPeriodEnd && (
                  <Button
                    variant="outline"
                    onClick={() => setShowCancelModal(true)}
                    disabled={cancelLoading}
                    className="w-full sm:w-auto border-amber-500/50 text-amber-600 dark:text-amber-400"
                  >
                    Cancel Subscription
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Scheduled cancellation notice */}
        {hasActiveSubscription && status.deleteAccountAtPeriodEnd && (
          <Card className="p-4 border-amber-500/30">
            <p className={cn(
              "text-sm",
              theme === 'dark' ? 'text-amber-400/90' : 'text-amber-600'
            )}>
              Your subscription is cancelled and your account will be deleted at the end of the billing period.
              {status.currentPeriodEndsAt && (
                <> You have full access until <strong>{new Date(status.currentPeriodEndsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.</>
              )}
            </p>
          </Card>
        )}

        {/* Plan Selection */}
        <div>
          <h3 className={cn(
            "text-lg font-medium mb-4",
            theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
          )}>Change Subscription Plan</h3>
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
                      <h4 className={cn(
                        "text-xl font-semibold",
                        theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                      )}>{plan.name}</h4>
                      <p className={cn(
                        "text-sm mt-1",
                        theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                      )}>{plan.description}</p>
                    </div>

                    <ul className="space-y-2">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className={cn(
                          "flex items-start text-sm",
                          theme === 'dark' ? 'text-primary-light/80' : 'text-primary-lightText'
                        )}>
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

      {/* Cancel Subscription modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false)
          setCancelConfirmText('')
        }}
        title="Cancel Subscription"
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCancelModal(false)
                setCancelConfirmText('')
              }}
              disabled={cancelLoading}
            >
              Keep Subscription
            </Button>
            <Button
              variant="danger"
              onClick={handleCancelAndScheduleDeletion}
              isLoading={cancelLoading}
              disabled={cancelConfirmText.toLowerCase().trim() !== CANCEL_CONFIRM_PHRASE}
            >
              Cancel Subscription
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className={cn(
            "text-sm",
            theme === 'dark' ? 'text-primary-light/80' : 'text-primary-lightTextSecondary'
          )}>
            This will cancel your active subscription and delete your account at the end of this billing period.
            {status?.currentPeriodEndsAt && (
              <span className="block mt-2 font-medium text-primary-gold">
                Your account will be deleted on {new Date(status.currentPeriodEndsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}. You will retain full access until this date.
              </span>
            )}
          </p>
          <p className={cn(
            "text-sm",
            theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
          )}>
            Type <strong>{CANCEL_CONFIRM_PHRASE}</strong> to confirm:
          </p>
          <input
            type="text"
            value={cancelConfirmText}
            onChange={e => setCancelConfirmText(e.target.value)}
            placeholder={CANCEL_CONFIRM_PHRASE}
            className={cn(
              "w-full px-3 py-2 rounded-lg border text-sm",
              theme === 'dark'
                ? 'bg-primary-dark border-white/20 text-primary-light placeholder:text-primary-light/40'
                : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-500'
            )}
            autoComplete="off"
          />
        </div>
      </Modal>
    </div>
  )
}
