import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

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
    title: 'CRM (Customer Management)',
    description:
      'Manage all your contacts in one place. Add customers, track their information, and keep notes about your interactions.',
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

  return (
    <Modal
      isOpen={isActive}
      onClose={handleClose}
      title={currentStep.title}
      size="md"
      closeOnOverlayClick={false}
      transparentBackdrop={true}
      mobilePosition="bottom"
      footer={
        <>
          <div className="flex-1 text-sm text-primary-light/60">
            Step {currentStepIndex + 1} of {TOUR_STEPS.length}
          </div>
          {!isFirstStep && (
            <Button variant="secondary" onClick={handleBack}>
              Back
            </Button>
          )}
          <Button variant="ghost" onClick={handleClose}>
            Skip Tour
          </Button>
          <Button onClick={handleNext}>{isLastStep ? 'Finish' : 'Next'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-primary-light text-base leading-relaxed">{currentStep.description}</p>

        {/* Progress indicator */}
        <div className="flex gap-2 pt-4">
          {TOUR_STEPS.map((_, index) => (
            <div
              key={index}
              className={`h-2 flex-1 rounded-full transition-colors ${
                index === currentStepIndex
                  ? 'bg-primary-gold'
                  : index < currentStepIndex
                    ? 'bg-primary-blue'
                    : 'bg-primary-dark'
              }`}
            />
          ))}
        </div>
      </div>
    </Modal>
  )
}
