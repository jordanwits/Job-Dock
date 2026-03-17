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
  canInviteMore?: boolean
  teamMemberLimit?: number | null
  canDowngrade?: boolean
  canDowngradeToTeam?: boolean
  canDowngradeToSingle?: boolean
  teamMemberCount?: number
}

const CANCEL_CONFIRM_PHRASE = 'cancel my account'

type PlanTier = 'single' | 'team' | 'team-plus'

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
    price: '$29.99/mo',
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
    description: 'Up to 5 users',
    price: '$59.99/mo',
    features: [
      'Everything in Single',
      'Up to 5 team members',
      'Team time tracking',
      'Shared calendar',
      'Role-based permissions',
    ],
  },
  {
    id: 'team-plus',
    name: 'Team+',
    description: 'Unlimited users',
    price: '$99.99/mo',
    features: [
      'Everything in Team',
      'Unlimited team members',
      'No user cap',
      'Best for growing crews',
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
  const [subscribing, setSubscribing] = useState<PlanTier | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showDeleteImmediateModal, setShowDeleteImmediateModal] = useState(false)
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

  const handleDeleteAccountImmediate = async () => {
    if (cancelConfirmText.toLowerCase().trim() !== CANCEL_CONFIRM_PHRASE) {
      alert(`Please type "${CANCEL_CONFIRM_PHRASE}" exactly to confirm.`)
      return
    }
    try {
      setCancelLoading(true)
      await services.billing.deleteAccount()
      window.location.href = '/'
    } catch (err: any) {
      console.error('Failed to delete account:', err)
      alert(err.response?.data?.message || 'Failed to delete account. Please try again.')
    } finally {
      setCancelLoading(false)
    }
  }

  const handleUpgrade = async (plan: 'team' | 'team-plus') => {
    try {
      setUpgrading(true)
      const { url } = await services.billing.createUpgradeCheckoutUrl(plan)
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

  const handleSubscribe = async (plan: PlanTier) => {
    try {
      setSubscribing(plan)
      const { url } = await services.billing.createCheckoutRedirectUrl({ plan })
      if (url) {
        window.location.href = url
      }
    } catch (err: any) {
      console.error('Subscribe failed:', err)
      alert(err.response?.data?.message || 'Failed to start subscription. Please try again.')
      setSubscribing(null)
    }
  }

  const handleChangePlan = async (newPlan: PlanTier) => {
    const currentTier = status?.subscriptionTier || 'single'
    
    if (newPlan === currentTier) {
      return // Already on this plan
    }

    // Downgrade: open Stripe portal to change plan
    if (
      (currentTier === 'team-plus' && (newPlan === 'team' || newPlan === 'single')) ||
      (currentTier === 'team' && newPlan === 'single')
    ) {
      if (newPlan === 'team' && currentTier === 'team-plus' && !status?.canDowngradeToTeam) {
        alert('You must remove team members (down to 5 or fewer) before downgrading to Team plan.')
        return
      }
      try {
        setChangingPlan(newPlan)
        await handleManageBilling()
      } finally {
        setChangingPlan(null)
      }
      return
    }

    // Upgrade
    if (newPlan === 'team' || newPlan === 'team-plus') {
      await handleUpgrade(newPlan)
    }
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

  const hasActiveSubscription =
    status.status === 'active' || status.status === 'trialing'
  const tier = status.subscriptionTier || (hasActiveSubscription ? 'single' : null)
  const isTeam = tier === 'team' || tier === 'team-plus'
  const displayTierName = tier === 'team-plus' ? 'Team+' : tier === 'team' ? 'Team' : tier === 'single' ? 'Single' : 'No subscription'

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
                Current plan: <span className="text-primary-gold">{displayTierName}</span>
              </p>
              {((hasActiveSubscription || tier) && (isTeam || tier === 'single')) && (
                <p className={cn(
                  "text-sm mt-1",
                  theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
                )}>
                  {isTeam
                    ? status.canInviteMore !== false
                      ? `You can invite team members.${status.teamMemberCount != null && status.teamMemberLimit ? ` (${status.teamMemberCount}/${status.teamMemberLimit})` : status.teamMemberCount != null ? ` (${status.teamMemberCount} member${status.teamMemberCount !== 1 ? 's' : ''})` : ''}`
                      : `Team limit reached (${status.teamMemberCount}/5). Upgrade to Team+ to add more.`
                    : 'Upgrade to Team to invite team members.'}
                </p>
              )}
              {tier === 'team-plus' && !status.canDowngradeToTeam && status.teamMemberCount != null && status.teamMemberCount > 5 && (
                <p className="text-sm text-amber-400/90 mt-1">
                  Remove team members (down to 5 or fewer) before downgrading to Team plan.
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {PLANS.map((plan) => {
              const isCurrentPlan = tier === plan.id
              const isChanging = changingPlan === plan.id
              const canSelect =
                hasActiveSubscription &&
                (plan.id === 'single'
                  ? tier === 'team' || tier === 'team-plus' // Allow downgrade; team members auto-removed
                  : plan.id === 'team'
                    ? tier === 'single' || (tier === 'team-plus' && status.canDowngradeToTeam)
                    : (plan.id === 'team-plus' && (tier === 'single' || tier === 'team')) || false)

              const getUpgradeLabel = () => {
                if (plan.id === 'single') return 'Downgrade to Single'
                if (plan.id === 'team') return tier === 'team-plus' ? 'Downgrade to Team' : 'Upgrade to Team'
                return 'Upgrade to Team+'
              }

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
                      )}>
                        {plan.name}
                        {plan.price && (
                          <span className="text-primary-gold font-semibold ml-2">{plan.price}</span>
                        )}
                      </h4>
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
                        <Button
                          variant={plan.id !== 'single' ? 'primary' : 'outline'}
                          onClick={() => handleSubscribe(plan.id)}
                          disabled={subscribing !== null}
                          className="w-full"
                        >
                          {subscribing === plan.id
                            ? 'Redirecting...'
                            : (tier === 'team' || tier === 'team-plus') && plan.id === 'single'
                              ? 'Switch to Single'
                              : 'Subscribe'}
                        </Button>
                      ) : !canSelect ? (
                        <Button variant="secondary" disabled className="w-full">
                          {plan.id === 'team' && tier === 'team-plus'
                            ? 'Remove team members first'
                            : 'Unavailable'}
                        </Button>
                      ) : (
                        <Button
                          variant={plan.id === 'team-plus' || (plan.id === 'team' && tier === 'single') ? 'primary' : 'outline'}
                          onClick={() => handleChangePlan(plan.id)}
                          disabled={isChanging || changingPlan !== null}
                          className="w-full"
                        >
                          {isChanging ? 'Processing...' : getUpgradeLabel()}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Delete account - Danger zone - always visible for account owners */}
        <Card className="p-4 border-red-500/30 dark:border-red-500/20">
          <h3 className={cn(
            "text-base font-medium mb-2",
            theme === 'dark' ? 'text-red-400' : 'text-red-600'
          )}>
            {status.hasSubscription ? 'Unsubscribe & delete account' : 'Delete account'}
          </h3>
          <p className={cn(
            "text-sm mb-4",
            theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
          )}>
            {status.hasSubscription ? (
              <>
                Cancel your Stripe subscription and permanently delete your account at the end of your current billing cycle. You will retain full access until then.
                {status.currentPeriodEndsAt && (
                  <span className="block mt-2 font-medium">
                    Access until: {new Date(status.currentPeriodEndsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </>
            ) : (
              'Permanently delete your account and all associated data. This action cannot be undone.'
            )}
          </p>
          {status.hasSubscription ? (
            !status.deleteAccountAtPeriodEnd ? (
              <Button
                variant="danger"
                onClick={() => setShowCancelModal(true)}
                disabled={cancelLoading}
              >
                Unsubscribe and delete account
              </Button>
            ) : (
              <p className={cn(
                "text-sm",
                theme === 'dark' ? 'text-amber-400/90' : 'text-amber-600'
              )}>
                Deletion scheduled. Your account will be removed at the end of the billing period.
              </p>
            )
          ) : (
            <Button
              variant="danger"
              onClick={() => setShowDeleteImmediateModal(true)}
              disabled={cancelLoading}
            >
              Delete account
            </Button>
          )}
        </Card>
      </div>

      {/* Unsubscribe and delete account modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false)
          setCancelConfirmText('')
        }}
        title="Unsubscribe and delete account"
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
              Unsubscribe and delete account
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

      {/* Delete account immediately modal */}
      <Modal
        isOpen={showDeleteImmediateModal}
        onClose={() => {
          setShowDeleteImmediateModal(false)
          setCancelConfirmText('')
        }}
        title="Delete account"
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteImmediateModal(false)
                setCancelConfirmText('')
              }}
              disabled={cancelLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccountImmediate}
              isLoading={cancelLoading}
              disabled={cancelConfirmText.toLowerCase().trim() !== CANCEL_CONFIRM_PHRASE}
            >
              Delete account
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className={cn(
            "text-sm",
            theme === 'dark' ? 'text-primary-light/80' : 'text-primary-lightTextSecondary'
          )}>
            This will permanently delete your account and all associated data. This action cannot be undone.
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
