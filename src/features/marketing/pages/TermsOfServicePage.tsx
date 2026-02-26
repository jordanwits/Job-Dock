import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import MarketingLayout from '../components/MarketingLayout'
import MarketingSection from '../components/MarketingSection'
import { publicSiteConfig, getFormattedAddress } from '../content/publicSiteConfig'

const TermsOfServicePage = () => {
  useEffect(() => {
    document.title = 'Terms of Service | JobDock'
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
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Terms of Service</h1>
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
                    Company
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    JobDock is operated by West Wave Creative, a DBA of Amicus Group, Inc.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    1. Acceptance of Terms
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    By accessing and using JobDock ("the Service"), you accept and agree to be bound by
                    these Terms of Service. If you do not agree to these terms, please do not use the
                    Service.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    2. Description of Service
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    JobDock provides a contractor management platform that enables service providers to
                    manage customer relationships, create quotes and invoices, schedule bookings, and send
                    automated transactional email notifications.
                  </p>
                  <p className="mt-4 text-base md:text-lg leading-relaxed">
                    SMS notifications are available only to users who opt in. Use of SMS is subject to user
                    consent. See our{' '}
                    <Link to="/sms-consent" className="text-primary-gold hover:text-primary-gold/80 underline font-semibold">
                      SMS Notifications Consent
                    </Link>
                    {' '}for program details and to opt in.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    3. User Accounts
                  </h2>
                  <p className="mb-4 text-base md:text-lg leading-relaxed">To use the Service, you must:</p>
                  <ul className="list-disc list-inside space-y-3 ml-4 text-base md:text-lg">
                    <li>Create an account with accurate and complete information</li>
                    <li>Maintain the security of your account credentials</li>
                    <li>Be at least 18 years old or the age of majority in your jurisdiction</li>
                    <li>Comply with all applicable laws and regulations</li>
                    <li>Not use the Service for any unlawful or fraudulent purpose</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    4. Acceptable Use Policy
                  </h2>
                  <p className="mb-4 text-base md:text-lg leading-relaxed">You agree not to:</p>
                  <ul className="list-disc list-inside space-y-3 ml-4 text-base md:text-lg">
                    <li>Send spam, unsolicited emails, or bulk marketing messages</li>
                    <li>Use the Service to harass, abuse, or harm others</li>
                    <li>Upload or transmit viruses, malware, or malicious code</li>
                    <li>Attempt to gain unauthorized access to the Service or other users' accounts</li>
                    <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
                    <li>
                      Violate any applicable laws, including CAN-SPAM Act and anti-spam regulations
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    5. Email Sending Policy
                  </h2>
                  <p className="mb-4 text-base md:text-lg leading-relaxed">
                    JobDock is designed for transactional email communications only. You agree to:
                  </p>
                  <ul className="list-disc list-inside space-y-3 ml-4 text-base md:text-lg">
                    <li>
                      Only send emails to recipients who have a business relationship with you (your
                      clients and customers)
                    </li>
                    <li>Never use purchased, rented, or third-party email lists</li>
                    <li>Include accurate sender information in all emails</li>
                    <li>Honor unsubscribe requests promptly</li>
                    <li>Comply with all applicable email and anti-spam laws</li>
                  </ul>
                  <p className="mt-4 text-base md:text-lg leading-relaxed font-semibold text-primary-dark">
                    We reserve the right to suspend or terminate accounts that violate this policy.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    6. Your Content
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    You retain ownership of all content you upload to the Service (customer data, quotes,
                    invoices, etc.). By using the Service, you grant us a limited license to use,
                    process, and transmit your content solely to provide the Service to you.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    7. Intellectual Property
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    The Service, including its design, features, and functionality, is owned by{' '}
                    {publicSiteConfig.copyrightHolder} and is protected by copyright, trademark, and other
                    intellectual property laws.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    8. Payment and Subscriptions
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    Certain features of the Service may require payment. By subscribing to a paid plan,
                    you agree to pay all applicable fees. Fees are non-refundable except as required by
                    law.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    9. Service Availability
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    We strive to provide reliable service but do not guarantee uninterrupted or
                    error-free operation. We reserve the right to modify, suspend, or discontinue the
                    Service at any time with reasonable notice.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    10. Limitation of Liability
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    To the maximum extent permitted by law, {publicSiteConfig.copyrightHolder} shall not
                    be liable for any indirect, incidental, special, consequential, or punitive damages
                    arising from your use of the Service.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    11. Termination
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    We may terminate or suspend your account at any time if you violate these Terms. You
                    may terminate your account at any time by contacting us. Upon termination, your right
                    to use the Service will immediately cease.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    12. Changes to Terms
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    We reserve the right to modify these Terms at any time. We will notify users of
                    material changes via email or through the Service. Your continued use of the Service
                    after changes constitutes acceptance of the modified Terms.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    13. Governing Law
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    These Terms shall be governed by and construed in accordance with the laws of the
                    United States, without regard to its conflict of law provisions.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    14. Contact Us
                  </h2>
                  <p className="mb-4 text-base md:text-lg leading-relaxed">
                    If you have questions about these Terms of Service, please contact us:
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

export default TermsOfServicePage
