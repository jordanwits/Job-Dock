import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import MarketingLayout from '../components/MarketingLayout'
import MarketingSection from '../components/MarketingSection'
import Button from '@/components/ui/Button'

const SMS_CONSENT_CHECKBOX_LABEL =
  'I agree to receive SMS notifications from JobDock regarding account alerts, appointment reminders, service updates, and billing notifications. Message frequency varies. Message and data rates may apply. Reply STOP to opt out. Reply HELP for help.'

const formatUSPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

const isValidUSPhone = (value: string): boolean => {
  const digits = value.replace(/\D/g, '')
  return digits.length === 10
}

const SmsConsentPage = () => {
  const [phone, setPhone] = useState('')
  const [consentChecked, setConsentChecked] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<{ phone?: string; consent?: string }>({})

  useEffect(() => {
    document.title = 'SMS Notifications Consent | JobDock'
    return () => {
      document.title = 'The Job Dock - Stop Juggling Tools. Run Your Jobs in One Place.'
    }
  }, [])

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatUSPhone(e.target.value))
    if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }))
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConsentChecked(e.target.checked)
    if (errors.consent) setErrors((prev) => ({ ...prev, consent: undefined }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: { phone?: string; consent?: string } = {}
    if (!isValidUSPhone(phone)) {
      newErrors.phone = 'Please enter a valid 10-digit US phone number.'
    }
    if (!consentChecked) {
      newErrors.consent = 'You must agree to receive SMS notifications to continue.'
    }
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return
    setSubmitted(true)
  }

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <MarketingSection variant="gradient-dark" className="pt-32 pb-16 md:pt-40 md:pb-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">SMS Notifications Consent</h1>
            <p className="text-lg text-white/70">
              Opt in to receive transactional SMS notifications from JobDock
            </p>
          </div>
        </div>
      </MarketingSection>

      {/* Content Section */}
      <MarketingSection variant="light">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg border border-primary-blue/10 p-8 md:p-12">
              <div className="space-y-10 text-primary-dark/80">
                {/* Program disclosure - Twilio compliance */}
                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    Program Information
                  </h2>
                  <dl className="space-y-3 text-base md:text-lg">
                    <div>
                      <dt className="font-semibold text-primary-dark">Company:</dt>
                      <dd>Amicus Group, Inc. (DBA West Wave Creative / JobDock)</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-primary-dark">Program description:</dt>
                      <dd>
                        JobDock sends SMS notifications to opted-in users for account alerts, appointment
                        reminders, service updates, and billing notifications (transactional/operational only,
                        no marketing).
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-primary-dark">Message frequency:</dt>
                      <dd>Message frequency varies.</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-primary-dark">Rates:</dt>
                      <dd>Message and data rates may apply.</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-primary-dark">Opt-out:</dt>
                      <dd>Reply STOP to opt out at any time.</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-primary-dark">Help:</dt>
                      <dd>Reply HELP for assistance.</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-primary-dark">Support email:</dt>
                      <dd>
                        <a
                          href="mailto:jordan@westwavecreative.com"
                          className="text-primary-gold hover:text-primary-gold/80 transition-colors font-semibold"
                        >
                          jordan@westwavecreative.com
                        </a>
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-4 text-base md:text-lg">
                    See our{' '}
                    <Link to="/privacy" className="text-primary-gold hover:text-primary-gold/80 underline font-semibold">
                      Privacy Policy
                    </Link>{' '}
                    and{' '}
                    <Link to="/terms" className="text-primary-gold hover:text-primary-gold/80 underline font-semibold">
                      Terms of Service
                    </Link>
                    .
                  </p>
                </section>

                {/* Opt-in form */}
                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    Opt In
                  </h2>
                  {submitted ? (
                    <div className="bg-primary-light border-2 border-primary-gold/30 rounded-xl p-6 text-center">
                      <p className="text-lg font-semibold text-primary-dark">
                        Thanks! SMS notifications will be enabled in-app soon.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div>
                        <label
                          htmlFor="sms-phone"
                          className="block text-sm font-medium text-primary-dark mb-2"
                        >
                          Phone number (US)
                        </label>
                        <input
                          id="sms-phone"
                          type="tel"
                          value={phone}
                          onChange={handlePhoneChange}
                          placeholder="(555) 555-5555"
                          className="flex h-10 w-full max-w-xs rounded-lg border-2 border-gray-200 px-3 py-2 text-sm text-primary-dark placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-primary-gold"
                          aria-invalid={!!errors.phone}
                          aria-describedby={errors.phone ? 'phone-error' : undefined}
                        />
                        {errors.phone && (
                          <p id="phone-error" className="mt-1 text-sm text-red-500">
                            {errors.phone}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <input
                            id="sms-consent"
                            type="checkbox"
                            checked={consentChecked}
                            onChange={handleCheckboxChange}
                            className="mt-1 w-4 h-4 rounded border-2 border-gray-300 text-primary-gold focus:ring-primary-gold cursor-pointer"
                            aria-invalid={!!errors.consent}
                            aria-describedby={errors.consent ? 'consent-error' : undefined}
                          />
                          <label
                            htmlFor="sms-consent"
                            className="text-sm text-primary-dark cursor-pointer select-none"
                          >
                            {SMS_CONSENT_CHECKBOX_LABEL}
                          </label>
                        </div>
                        {errors.consent && (
                          <p id="consent-error" className="text-sm text-red-500">
                            {errors.consent}
                          </p>
                        )}
                        <p className="text-sm text-primary-dark/70">
                          <Link to="/privacy" className="text-primary-gold hover:text-primary-gold/80 underline">
                            Privacy Policy
                          </Link>
                          {' · '}
                          <Link to="/terms" className="text-primary-gold hover:text-primary-gold/80 underline">
                            Terms of Service
                          </Link>
                        </p>
                      </div>

                      <Button type="submit" variant="primary" size="lg">
                        Submit
                      </Button>
                    </form>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      </MarketingSection>
    </MarketingLayout>
  )
}

export default SmsConsentPage
