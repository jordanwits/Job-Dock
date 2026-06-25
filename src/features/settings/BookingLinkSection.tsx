import { useState } from 'react'
import { useAuthStore } from '@/features/auth'
import {
  AppButton,
  Panel,
  SettingsSection,
  InfoPanel,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  InfoIcon,
} from './settingsUi'

export const BookingLinkSection = () => {
  const { user } = useAuthStore()
  const [copied, setCopied] = useState(false)

  const tenantId = user?.tenantId || localStorage.getItem('tenant_id') || ''
  const baseUrl = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin
  const bookingLink = `${baseUrl}/book?tenant=${tenantId}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <SettingsSection
      title="Public Booking Link"
      description="Share this link with your clients so they can book your services online"
    >
      <Panel className="p-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 break-all font-mono text-sm text-ink">{bookingLink}</div>
          <AppButton onClick={handleCopy} variant="subtle" size="sm" className="shrink-0">
            {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy link'}
          </AppButton>
        </div>
      </Panel>

      <InfoPanel>
        <div className="flex gap-3">
          <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" />
          <div>
            <p className="mb-1 font-medium text-ink">How it works:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>Clients can view all your active services</li>
              <li>They can select a service and see available time slots</li>
              <li>No account required — they just enter their contact info</li>
              <li>You'll receive the booking in your calendar</li>
            </ul>
          </div>
        </div>
      </InfoPanel>

      <div className="flex gap-2">
        <AppButton onClick={() => window.open(bookingLink, '_blank')} variant="subtle" size="sm">
          <ExternalLinkIcon className="h-4 w-4" />
          Preview
        </AppButton>
      </div>
    </SettingsSection>
  )
}
