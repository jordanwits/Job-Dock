import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import MarketingLayout from '../components/MarketingLayout'
import MarketingSection from '../components/MarketingSection'

const SmsConsentPage = () => {
  useEffect(() => {
    document.title = 'SMS Notifications Consent | JobDock'
    return () => {
      document.title = 'The Job Dock - Stop Juggling Tools. Run Your Jobs in One Place.'
    }
  }, [])

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <MarketingSection variant="gradient-dark" className="pt-32 pb-16 md:pt-40 md:pb-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">SMS Notifications Consent</h1>
            <p className="text-lg text-white/70">
              Program information for transactional SMS notifications
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
              </div>
            </div>
          </div>
        </div>
      </MarketingSection>
    </MarketingLayout>
  )
}

export default SmsConsentPage
