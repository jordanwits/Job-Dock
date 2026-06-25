import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authService } from '@/lib/api/services'
import { SIGNUP_PLANS, type PlanTier } from '../constants/plans'
import MarketingLayout from '@/features/marketing/components/MarketingLayout'
import { cn } from '@/lib/utils'
import { AuthButton, AuthAlert, authLinkCls } from '../components/authUi'

const SignupPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated } = useAuthStore()
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null)
  const [canceledMessage, setCanceledMessage] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app')
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    if (searchParams.get('canceled') === '1') {
      setCanceledMessage(true)
      window.history.replaceState({}, '', '/auth/signup')
    }
  }, [searchParams])

  // Preselect a plan when arriving from a landing-page pricing CTA (/auth/signup?plan=team).
  useEffect(() => {
    const plan = searchParams.get('plan')
    if (plan && SIGNUP_PLANS.some(p => p.id === plan)) {
      setSelectedPlan(plan as PlanTier)
    }
  }, [searchParams])

  const onPlanSelect = (planId: PlanTier) => {
    setSelectedPlan(planId)
  }

  const onStartTrial = async (planId?: PlanTier) => {
    const plan = planId ?? selectedPlan
    if (!plan) return
    setError(null)
    setIsLoading(true)
    try {
      const { checkoutUrl } = await authService.createSignupCheckoutUrl(plan)
      if (checkoutUrl) {
        window.location.href = checkoutUrl
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to start trial. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <MarketingLayout>
      <div className="auth-scope bg-canvas">
        <div className="container mx-auto px-4 pb-16 pt-24 md:px-6 md:pb-20 md:pt-32">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 text-center md:mb-12">
              <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
                Choose your plan
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-[15px] text-ink-muted md:text-base">
                All plans include a 14-day free trial. You&apos;ll add your payment method in the
                next step.
              </p>
            </div>

            {canceledMessage && (
              <div className="mx-auto mb-6 max-w-xl">
                <AuthAlert tone="warning">
                  Checkout was canceled. Select a plan and try again.
                </AuthAlert>
              </div>
            )}

            {error && (
              <div className="mx-auto mb-6 max-w-xl">
                <AuthAlert tone="danger">{error}</AuthAlert>
              </div>
            )}

            <div className="mb-10 grid min-w-0 gap-5 md:grid-cols-3">
              {SIGNUP_PLANS.map(plan => {
                const selected = selectedPlan === plan.id
                return (
                  <div
                    key={plan.id}
                    role="group"
                    onClick={() => onPlanSelect(plan.id)}
                    className={cn(
                      'flex min-w-0 cursor-pointer flex-col whitespace-normal rounded-2xl p-6 text-left shadow-card transition-all md:p-7',
                      selected
                        ? 'bg-accent-soft ring-2 ring-accent'
                        : 'bg-surface ring-1 ring-line hover:ring-border-strong'
                    )}
                  >
                    <div className="mb-6 w-full min-w-0">
                      <h3 className="mb-4 break-words text-xl font-bold leading-tight text-ink">
                        {plan.name}
                      </h3>
                      <div className="mb-2 flex flex-wrap items-baseline gap-1.5">
                        <span className="break-words font-mono text-3xl font-semibold leading-none tabular-nums text-ink">
                          {plan.price}
                        </span>
                      </div>
                      <p className="break-words text-sm font-medium leading-relaxed text-ink-muted">
                        {plan.description}
                      </p>
                    </div>

                    <ul className="w-full min-w-0 flex-1 space-y-3.5 border-t border-line pt-6 text-sm text-ink-muted">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex min-w-0 items-start gap-3">
                          <span className="mt-[3px] flex-none text-accent-strong">
                            <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]">
                              <path
                                d="M5 13l4 4L19 7"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                          <span className="min-w-0 whitespace-normal break-words leading-relaxed">
                            {f}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <AuthButton
                      onClick={e => {
                        e.stopPropagation()
                        onStartTrial(plan.id)
                      }}
                      disabled={isLoading}
                      fullWidth
                      className="mt-6 block md:hidden"
                    >
                      {isLoading ? 'Redirecting...' : 'Start trial'}
                    </AuthButton>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="order-2 flex flex-1 items-center sm:order-1">
                <span className="text-sm text-ink-muted">
                  Already have an account?{' '}
                  <Link to="/auth/login" className={authLinkCls}>
                    Sign in
                  </Link>
                </span>
              </div>
              <div className="order-1 hidden flex-1 md:flex sm:order-2">
                <AuthButton
                  onClick={() => onStartTrial()}
                  disabled={!selectedPlan || isLoading}
                  fullWidth
                >
                  {isLoading ? 'Redirecting...' : 'Start trial'}
                </AuthButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MarketingLayout>
  )
}

export default SignupPage
