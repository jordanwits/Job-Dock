import { useState } from 'react'
import { Button } from '@/components/ui'
import { useAuthStore } from '@/features/auth'
import { CollapsibleSection } from './CollapsibleSection'

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
    <CollapsibleSection title="Public Booking Link">
      <div className="space-y-4">
        <p className="text-sm text-primary-light/70">
          Share this link with your clients so they can book your services online
        </p>

        <div className="bg-primary-dark-secondary rounded-lg p-4 border border-primary-blue">
          <div className="flex items-center gap-3">
            <div className="flex-1 font-mono text-sm text-primary-light break-all">
              {bookingLink}
            </div>
            <Button
              onClick={handleCopy}
              variant="secondary"
              size="sm"
              className="shrink-0"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Link
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="bg-primary-blue/10 rounded-lg p-4 border border-primary-blue">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-primary-gold shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-primary-light/70">
              <p className="font-medium text-primary-light mb-1">How it works:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Clients can view all your active services</li>
                <li>They can select a service and see available time slots</li>
                <li>No account required - they just enter their contact info</li>
                <li>You'll receive the booking in your calendar</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => window.open(bookingLink, '_blank')}
            variant="secondary"
            size="sm"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Preview
          </Button>
        </div>
      </div>
    </CollapsibleSection>
  )
}
