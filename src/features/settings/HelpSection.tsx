import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui'
import { onboardingApi } from '@/lib/api/onboarding'
import { useAuthStore } from '@/features/auth'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { AppButton, Panel, SettingsSection, SubHeading, linkCls } from './settingsUi'

const SUPPORT_EMAIL = 'jordan@westwavecreative.com'

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
      await onboardingApi.reset()

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
    <SettingsSection title="Help & Support">
      <div className="space-y-4">
        {/* Tutorial Section */}
        <Panel className="space-y-4 p-5 sm:p-6">
          <div>
            <SubHeading className="mb-2">Tutorial</SubHeading>
            <p className="text-sm leading-relaxed text-ink-muted">
              Go through the tutorial flow again to set up your company information, upload your
              logo, and take a tour of the application.
            </p>
          </div>
          <AppButton variant="subtle" onClick={handleRestartOnboarding} isLoading={resettingOnboarding}>
            Play tutorial
          </AppButton>
        </Panel>

        {/* Help chatbot */}
        <Panel className="p-5 sm:p-6">
          <SubHeading className="mb-2">Help chat</SubHeading>
          <p className="text-sm leading-relaxed text-ink-muted">
            Use the <strong className="font-medium text-ink">Help</strong> button in the lower-right
            corner to ask how-to questions, get troubleshooting tips, or send a report to engineering
            (includes your conversation).
          </p>
        </Panel>

        {/* Support email */}
        <Panel className="space-y-4 p-5 sm:p-6">
          <div>
            <SubHeading className="mb-2">Contact support</SubHeading>
            <p className="text-sm leading-relaxed text-ink-muted">
              Questions or issues? Email us and we will get back to you.
            </p>
          </div>
          <a href={`mailto:${SUPPORT_EMAIL}`} className={`text-sm ${linkCls}`}>
            {SUPPORT_EMAIL}
          </a>
        </Panel>

        {/* Install App Section */}
        {!isStandalone && (isInstallable || isIOS) && (
          <Panel className="space-y-4 p-5 sm:p-6">
            <div>
              <SubHeading className="mb-2">Install app</SubHeading>
              <p className="text-sm leading-relaxed text-ink-muted">
                {isIOS
                  ? 'Add JobDock to your home screen for quick access and a better mobile experience.'
                  : 'Install JobDock on your device for quick access and offline capabilities.'}
              </p>
            </div>
            <AppButton variant="subtle" onClick={handleInstallClick}>
              {isIOS ? 'Show installation instructions' : 'Install app'}
            </AppButton>
          </Panel>
        )}

        {/* Tutorial Videos Section */}
        <Panel className="space-y-4 p-5 sm:p-6">
          <div>
            <SubHeading className="mb-2">Tutorial videos</SubHeading>
            <p className="text-sm leading-relaxed text-ink-muted">
              Watch video tutorials to learn how to use JobDock effectively.
            </p>
          </div>
          <p className="text-sm italic text-ink-subtle">Tutorial videos will be added here soon.</p>
        </Panel>
      </div>

      {/* iOS Installation Instructions Modal */}
      <Modal
        isOpen={showIOSInstructions}
        onClose={() => setShowIOSInstructions(false)}
        title="Install JobDock on iOS"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">To add JobDock to your home screen:</p>
          <ol className="list-inside list-decimal space-y-3 text-sm text-ink-muted">
            <li>
              Tap the <strong className="text-ink">Share</strong> button{' '}
              <svg className="inline-block h-4 w-4 align-middle" fill="currentColor" viewBox="0 0 24 24">
                <rect x="5" y="9" width="14" height="14" rx="1" />
                <path d="M12 3v6m-3-3l3-3 3 3" />
              </svg>{' '}
              at the bottom of your screen
            </li>
            <li>
              Scroll down and tap <strong className="text-ink">"Add to Home Screen"</strong>
            </li>
            <li>
              Tap <strong className="text-ink">"Add"</strong> in the top right corner
            </li>
          </ol>
          <div className="pt-4">
            <AppButton onClick={() => setShowIOSInstructions(false)} fullWidth>
              Got it
            </AppButton>
          </div>
        </div>
      </Modal>
    </SettingsSection>
  )
}
