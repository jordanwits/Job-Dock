import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card } from '@/components/ui'
import { onboardingApi } from '@/lib/api/onboarding'
import { useAuthStore } from '@/features/auth'

export const HelpSection = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [resettingOnboarding, setResettingOnboarding] = useState(false)

  const handleRestartOnboarding = async () => {
    try {
      setResettingOnboarding(true)
      
      // Reset onboarding status
      const result = await onboardingApi.reset()
      
      // Update user in auth store
      if (user) {
        useAuthStore.setState({
          user: {
            ...user,
            onboardingCompletedAt: null,
          },
        })
      }
      
      // Small delay to ensure state update propagates
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Navigate to onboarding page
      navigate('/app/onboarding')
    } catch (error: any) {
      console.error('Failed to reset onboarding:', error)
      alert(`Failed to start tutorial: ${error.response?.data?.error?.message || error.message}`)
    } finally {
      setResettingOnboarding(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-primary-light">Help & Support</h2>
      
      <div className="space-y-6">
        {/* Tutorial Section */}
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-primary-light mb-2">Tutorial</h3>
              <p className="text-sm text-primary-light/70">
                Go through the tutorial flow again to set up your company information, upload your logo, and take a tour of the application.
              </p>
            </div>
            <Button
              onClick={handleRestartOnboarding}
              disabled={resettingOnboarding}
              isLoading={resettingOnboarding}
              variant="outline"
            >
              Play Tutorial
            </Button>
          </div>
        </Card>

        {/* Tutorial Videos Section */}
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-primary-light mb-2">Tutorial Videos</h3>
              <p className="text-sm text-primary-light/70">
                Watch video tutorials to learn how to use JobDock effectively.
              </p>
            </div>
            <div className="text-sm text-primary-light/50 italic">
              Tutorial videos will be added here soon.
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
