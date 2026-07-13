import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { AppButton, ArrowLeftIcon } from './onboardingUi'

interface TourStep {
  path: string
  title: string
  description: string
}

const TOUR_STEPS: TourStep[] = [
  {
    path: '/app',
    title: 'Dashboard',
    description:
      'Your central hub. See a quick overview of your business with recent quotes, invoices, and upcoming jobs all in one place.',
  },
  {
    path: '/app/crm',
    title: 'Contacts',
    description:
      'Manage all your contacts in one place. Add customers, track their information, and keep notes about your interactions.',
  },
  {
    path: '/app/job-logs',
    title: 'Jobs',
    description:
      'Create jobs, track time, capture photos, and take notes on jobsites. Manage your job log entries and link them to scheduled work.',
  },
  {
    path: '/app/quotes',
    title: 'Quotes',
    description:
      'Create and send professional quotes to your customers. Track which quotes are pending, approved, or declined.',
  },
  {
    path: '/app/invoices',
    title: 'Invoices',
    description:
      'Generate invoices and track payments. See which invoices are paid, pending, or overdue at a glance.',
  },
  {
    path: '/app/scheduling',
    title: 'Calendar',
    description:
      'Schedule and manage jobs on an interactive calendar. Create one-time jobs or set up recurring schedules.',
  },
]

export const AppTourOverlay = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isActive, setIsActive] = useState(false)

  // Check if tour should start
  useEffect(() => {
    if (searchParams.get('tour') === 'start') {
      setIsActive(true)
      setCurrentStepIndex(0)
      // Remove tour param from URL
      searchParams.delete('tour')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Update step index when path changes during tour
  useEffect(() => {
    if (isActive) {
      const stepIndex = TOUR_STEPS.findIndex(step => step.path === location.pathname)
      if (stepIndex !== -1 && stepIndex !== currentStepIndex) {
        setCurrentStepIndex(stepIndex)
      }
    }
  }, [location.pathname, isActive, currentStepIndex])

  // Close on Escape
  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isActive])

  const currentStep = TOUR_STEPS[currentStepIndex]
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1

  const handleNext = () => {
    if (isLastStep) {
      handleClose()
    } else {
      const nextStep = TOUR_STEPS[currentStepIndex + 1]
      navigate(nextStep.path)
      setCurrentStepIndex(currentStepIndex + 1)
    }
  }

  const handleBack = () => {
    if (!isFirstStep) {
      const prevStep = TOUR_STEPS[currentStepIndex - 1]
      navigate(prevStep.path)
      setCurrentStepIndex(currentStepIndex - 1)
    }
  }

  const handleClose = () => {
    setIsActive(false)
    setCurrentStepIndex(0)
  }

  if (!isActive) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/20 p-4 sm:items-center">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-surface shadow-pop">
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-strong">
              Tour
            </span>
            <span className="font-mono text-[13px] tabular-nums text-ink-subtle">
              {currentStepIndex + 1}/{TOUR_STEPS.length}
            </span>
          </div>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-ink">{currentStep.title}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
            {currentStep.description}
          </p>

          {/* Progress indicator */}
          <div className="mt-5 flex gap-1.5">
            {TOUR_STEPS.map((_, index) => (
              <div
                key={index}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  index === currentStepIndex
                    ? 'bg-accent-strong'
                    : index < currentStepIndex
                      ? 'bg-accent'
                      : 'bg-line'
                )}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 border-t border-line px-6 py-4">
          {!isFirstStep && (
            <AppButton variant="ghost" onClick={handleBack}>
              <ArrowLeftIcon className="h-4 w-4" />
              Back
            </AppButton>
          )}
          <AppButton variant="ghost" onClick={handleClose} className="mr-auto">
            Skip tour
          </AppButton>
          <AppButton onClick={handleNext}>{isLastStep ? 'Finish' : 'Next'}</AppButton>
        </div>
      </div>
    </div>,
    document.body
  )
}
