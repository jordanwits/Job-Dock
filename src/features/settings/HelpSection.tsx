import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Modal } from '@/components/ui'
import { onboardingApi } from '@/lib/api/onboarding'
import { useAuthStore } from '@/features/auth'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

export const HelpSection = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [resettingOnboarding, setResettingOnboarding] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const { isInstallable, isIOS, isStandalone, promptInstall } = useInstallPrompt()

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

  const handleInstallClick = async () => {
    if (isIOS) {
      // Show iOS instructions
      setShowIOSInstructions(true)
    } else if (isInstallable) {
      // Trigger Android/Chrome install prompt
      await promptInstall()
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

        {/* Install App Section */}
        {!isStandalone && (isInstallable || isIOS) && (
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-primary-light mb-2">Install App</h3>
                <p className="text-sm text-primary-light/70">
                  {isIOS
                    ? 'Add JobDock to your home screen for quick access and a better mobile experience.'
                    : 'Install JobDock on your device for quick access and offline capabilities.'}
                </p>
              </div>
              <Button
                onClick={handleInstallClick}
                variant="outline"
              >
                {isIOS ? 'Show Installation Instructions' : 'Install App'}
              </Button>
            </div>
          </Card>
        )}

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

      {/* iOS Installation Instructions Modal */}
      <Modal
        isOpen={showIOSInstructions}
        onClose={() => setShowIOSInstructions(false)}
        title="Install JobDock on iOS"
      >
        <div className="space-y-4">
          <p className="text-sm text-primary-light/70">
            To add JobDock to your home screen:
          </p>
          <ol className="list-decimal list-inside space-y-3 text-sm text-primary-light/70">
            <li>
              Tap the <strong className="text-primary-light">Share</strong> button{' '}
              <svg className="inline-block w-4 h-4 align-middle" fill="currentColor" viewBox="0 0 24 24">
                <rect x="5" y="9" width="14" height="14" rx="1"/>
                <path d="M12 3v6m-3-3l3-3 3 3"/>
              </svg>{' '}
              at the bottom of your screen
            </li>
            <li>
              Scroll down and tap <strong className="text-primary-light">"Add to Home Screen"</strong>
            </li>
            <li>
              Tap <strong className="text-primary-light">"Add"</strong> in the top right corner
            </li>
          </ol>
          <div className="pt-4">
            <Button
              onClick={() => setShowIOSInstructions(false)}
              variant="primary"
              className="w-full"
            >
              Got it
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
