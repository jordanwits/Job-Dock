import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authService } from '@/lib/api/services'
import { SIGNUP_PLANS, type PlanTier } from '../constants/plans'
import { Button } from '@/components/ui'
import MarketingLayout from '@/features/marketing/components/MarketingLayout'
import { cn } from '@/lib/utils'

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
      <div className="container mx-auto px-4 md:px-6 pt-24 md:pt-32 pb-12 md:pb-16">
        <div className="max-w-4xl mx-auto">
        <div className="mb-10 text-center space-y-2">
          <h1 className="text-4xl font-bold text-primary-gold">JobDock</h1>
          <p className="text-primary-dark/70">Contractor Management Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-primary-blue/10 p-8 md:p-12">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4">Choose your plan</h2>
              <p className="text-primary-dark/70 text-base md:text-lg max-w-xl mx-auto">
                All plans include a 14-day free trial. You&apos;ll add your payment method in the next step.
              </p>
            </div>

            {canceledMessage && (
              <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm text-amber-800">
                  Checkout was canceled. Select a plan and try again.
                </p>
              </div>
            )}

            {error && (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-3 mb-10 min-w-0">
              {SIGNUP_PLANS.map(plan => (
                <div
                  key={plan.id}
                  role="group"
                  onClick={() => onPlanSelect(plan.id)}
                  className={cn(
                    'text-left p-6 md:p-8 rounded-2xl border-2 transition-all min-w-0 whitespace-normal flex flex-col cursor-pointer',
                    selectedPlan === plan.id
                      ? 'border-primary-gold bg-primary-gold/5 shadow-md relative ring-1 ring-primary-gold'
                      : 'border-primary-blue/10 hover:border-primary-gold/40 bg-white'
                  )}
                >
                  <div className="min-w-0 mb-6 w-full">
                    <h3 className="font-bold text-primary-dark text-xl leading-tight break-words mb-4">
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline gap-1.5 flex-wrap mb-2">
                      <span className="text-primary-dark font-bold text-3xl leading-none break-words">
                        {plan.price}
                      </span>
                    </div>
                    <p className="text-sm text-primary-dark/70 font-medium leading-relaxed break-words">
                      {plan.description}
                    </p>
                  </div>

                  <ul className="min-w-0 space-y-3.5 text-sm text-primary-dark/80 flex-1 w-full pt-6 border-t border-primary-blue/10">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-3 min-w-0">
                        <span className="mt-[3px] flex-none text-primary-gold">
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
                        <span className="min-w-0 leading-relaxed break-words whitespace-normal">
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      onStartTrial(plan.id)
                    }}
                    disabled={isLoading}
                    className="mt-6 w-full block md:hidden"
                  >
                    {isLoading ? 'Redirecting...' : 'Start trial'}
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 order-2 sm:order-1 flex items-center">
                <span className="text-primary-dark/70">
                  Already have an account?{' '}
                  <Link to="/auth/login" className="text-primary-gold no-underline hover:text-primary-gold">
                    Sign in
                  </Link>
                </span>
              </div>
              <div className="hidden md:flex flex-1 order-1 sm:order-2">
                <Button
                  onClick={() => onStartTrial()}
                  disabled={!selectedPlan || isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Redirecting...' : 'Start trial'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MarketingLayout>
  )
}

export default SignupPage
