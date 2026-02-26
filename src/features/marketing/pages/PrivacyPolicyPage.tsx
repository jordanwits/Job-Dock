import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import MarketingLayout from '../components/MarketingLayout'
import MarketingSection from '../components/MarketingSection'
import { publicSiteConfig, getFormattedAddress } from '../content/publicSiteConfig'

const PrivacyPolicyPage = () => {
  useEffect(() => {
    document.title = 'Privacy Policy | JobDock'
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
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Privacy Policy</h1>
            <p className="text-lg text-white/70">
              Last Updated: January {publicSiteConfig.copyrightYear}
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
                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    Who We Are
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    JobDock is operated by West Wave Creative, a DBA of Amicus Group, Inc., a California S-Corporation.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    1. Information We Collect
                  </h2>
                  <p className="mb-4 text-base md:text-lg leading-relaxed">
                    When you use JobDock, we collect information that you provide directly to us:
                  </p>
                  <ul className="list-disc list-inside space-y-3 ml-4 text-base md:text-lg">
                    <li>
                      <strong className="text-primary-dark">Account Information:</strong> Name, email address, company name, and
                      password when you create an account
                    </li>
                    <li>
                      <strong className="text-primary-dark">Business Information:</strong> Company details, logo, contact information,
                      and business preferences
                    </li>
                    <li>
                      <strong className="text-primary-dark">Customer Data:</strong> Contact information for your clients (names, email
                      addresses, phone numbers, addresses)
                    </li>
                    <li>
                      <strong className="text-primary-dark">Phone Numbers for SMS:</strong> We collect phone numbers from users who opt in
                      to receive SMS notifications for account alerts, appointment reminders, service updates, and
                      billing notifications.
                    </li>
                    <li>
                      <strong className="text-primary-dark">Transaction Data:</strong> Quotes, invoices, bookings, and related business
                      documents
                    </li>
                    <li>
                      <strong className="text-primary-dark">Usage Data:</strong> Information about how you use our service, including
                      access times and features used
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    2. How We Use Your Information
                  </h2>
                  <p className="mb-4 text-base md:text-lg leading-relaxed">We use the information we collect to:</p>
                  <ul className="list-disc list-inside space-y-3 ml-4 text-base md:text-lg">
                    <li>Provide, maintain, and improve our services</li>
                    <li>Send transactional emails (quotes, invoices, booking confirmations)</li>
                    <li>Process and manage your account</li>
                    <li>Respond to your support requests and communications</li>
                    <li>Ensure the security and integrity of our services</li>
                    <li>Comply with legal obligations</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    2a. SMS Notifications
                  </h2>
                  <p className="mb-4 text-base md:text-lg leading-relaxed">
                    We collect phone numbers only from users who opt in. Message frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out. Reply HELP for help. We do not sell phone numbers.
                  </p>
                  <p className="text-base md:text-lg leading-relaxed">
                    We only send SMS messages to users who have opted in. We do not sell or share your phone
                    number with third parties for marketing. To opt out of SMS at any time, reply STOP to any
                    message. For help, reply HELP or contact us at{' '}
                    <a
                      href="mailto:noreply@thejobdock.com"
                      className="text-primary-gold hover:text-primary-gold/80 transition-colors font-semibold"
                    >
                      noreply@thejobdock.com
                    </a>
                    . For full program details, see our{' '}
                    <Link to="/sms-consent" className="text-primary-gold hover:text-primary-gold/80 underline font-semibold">
                      SMS Notifications Consent
                    </Link>
                    .
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    3. Information Sharing and Disclosure
                  </h2>
                  <p className="mb-4 text-base md:text-lg leading-relaxed">
                    We do not sell or rent your personal information to third parties. We may share your
                    information only in the following circumstances:
                  </p>
                  <ul className="list-disc list-inside space-y-3 ml-4 text-base md:text-lg">
                    <li>
                      <strong className="text-primary-dark">With Your Clients:</strong> When you send quotes, invoices, or booking
                      confirmations to your clients
                    </li>
                    <li>
                      <strong className="text-primary-dark">Service Providers:</strong> With third-party vendors who help us provide our
                      services (e.g., AWS for hosting, email delivery)
                    </li>
                    <li>
                      <strong className="text-primary-dark">Legal Requirements:</strong> When required by law or to protect our rights
                      and safety
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    4. Data Security
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    We implement industry-standard security measures to protect your data, including
                    encryption, secure authentication, and regular security audits. However, no method of
                    transmission over the internet is 100% secure, and we cannot guarantee absolute
                    security.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    5. Data Retention
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    We retain your account information and business data for as long as your account is
                    active or as needed to provide you services. You may request deletion of your account
                    and data at any time by contacting us.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    6. Your Rights
                  </h2>
                  <p className="mb-4 text-base md:text-lg leading-relaxed">You have the right to:</p>
                  <ul className="list-disc list-inside space-y-3 ml-4 text-base md:text-lg">
                    <li>Access and review your personal information</li>
                    <li>Correct or update your information</li>
                    <li>Delete your account and associated data</li>
                    <li>Export your data</li>
                    <li>Opt out of non-essential communications</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    7. Cookies and Tracking
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    We use essential cookies to maintain your session and remember your preferences. We do
                    not use advertising or tracking cookies.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    8. Changes to This Policy
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    We may update this Privacy Policy from time to time. We will notify you of any
                    material changes by posting the new policy on this page and updating the "Last
                    Updated" date.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    9. Contact Us
                  </h2>
                  <p className="mb-4 text-base md:text-lg leading-relaxed">
                    If you have questions about this Privacy Policy, please contact us:
                  </p>
                  <div className="bg-primary-light border-2 border-primary-gold/20 rounded-xl p-6 mt-4">
                    <p className="mb-3 text-base md:text-lg">
                      <strong className="text-primary-dark">Email:</strong>{' '}
                      <a
                        href="mailto:noreply@thejobdock.com"
                        className="text-primary-gold hover:text-primary-gold/80 transition-colors font-semibold"
                      >
                        noreply@thejobdock.com
                      </a>
                    </p>
                    <p className="text-base md:text-lg">
                      <strong className="text-primary-dark">Address:</strong> {getFormattedAddress()}
                    </p>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </MarketingSection>
    </MarketingLayout>
  )
}

export default PrivacyPolicyPage
