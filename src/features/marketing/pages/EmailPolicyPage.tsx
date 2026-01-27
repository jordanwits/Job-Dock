import { Link } from 'react-router-dom'
import MarketingLayout from '../components/MarketingLayout'
import MarketingSection from '../components/MarketingSection'
import { publicSiteConfig, getFormattedAddress } from '../content/publicSiteConfig'

const EmailPolicyPage = () => {
  return (
    <MarketingLayout>
      {/* Hero Section */}
      <MarketingSection variant="gradient-dark" className="pt-32 pb-16 md:pt-40 md:pb-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Email Communication Policy</h1>
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
                    Overview
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    JobDock is committed to responsible email communication. This policy explains what emails we send, who receives them, and how we maintain compliance with email regulations.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    1. Types of Emails We Send
                  </h2>
                  <p className="mb-6 text-base md:text-lg leading-relaxed">
                    JobDock sends only transactional emails related to business operations. We do not send marketing emails, newsletters, or promotional content.
                  </p>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-primary-light border-2 border-primary-blue/10 rounded-xl p-5 hover:border-primary-gold/30 transition-colors">
                      <h3 className="text-lg font-bold text-primary-dark mb-2">
                        Quotes & Invoices
                      </h3>
                      <p className="text-sm md:text-base text-primary-dark/70 leading-relaxed">
                        Automatic notifications when contractors send quotes or invoices, including PDF attachments.
                      </p>
                    </div>

                    <div className="bg-primary-light border-2 border-primary-blue/10 rounded-xl p-5 hover:border-primary-gold/30 transition-colors">
                      <h3 className="text-lg font-bold text-primary-dark mb-2">
                        Booking Confirmations
                      </h3>
                      <p className="text-sm md:text-base text-primary-dark/70 leading-relaxed">
                        Confirmation emails when clients book appointments, including details and options to manage bookings.
                      </p>
                    </div>

                    <div className="bg-primary-light border-2 border-primary-blue/10 rounded-xl p-5 hover:border-primary-gold/30 transition-colors">
                      <h3 className="text-lg font-bold text-primary-dark mb-2">
                        Job Updates
                      </h3>
                      <p className="text-sm md:text-base text-primary-dark/70 leading-relaxed">
                        Status notifications when job progress changes, keeping clients informed throughout the process.
                      </p>
                    </div>

                    <div className="bg-primary-light border-2 border-primary-blue/10 rounded-xl p-5 hover:border-primary-gold/30 transition-colors">
                      <h3 className="text-lg font-bold text-primary-dark mb-2">
                        Account Notifications
                      </h3>
                      <p className="text-sm md:text-base text-primary-dark/70 leading-relaxed">
                        Essential account updates, security alerts, and service-related communications.
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    2. Who Receives Emails
                  </h2>
                  <p className="mb-4 text-base md:text-lg leading-relaxed">Emails are sent only to:</p>
                  <ul className="list-disc list-inside space-y-3 ml-4 text-base md:text-lg mb-4">
                    <li>
                      <strong className="text-primary-dark">Business Users:</strong> Contractors who create JobDock accounts to manage their business
                    </li>
                    <li>
                      <strong className="text-primary-dark">Their Clients:</strong> Customers who book services, request quotes, or receive invoices from JobDock users
                    </li>
                  </ul>
                  <p className="mt-6 mb-3 text-lg font-bold text-primary-dark">
                    We never:
                  </p>
                  <ul className="list-disc list-inside space-y-3 ml-4 text-base md:text-lg">
                    <li>Purchase, rent, or use third-party email lists</li>
                    <li>Send unsolicited bulk emails or spam</li>
                    <li>Share your email address with third parties for marketing</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    3. CAN-SPAM Compliance
                  </h2>
                  <p className="mb-4 text-base md:text-lg leading-relaxed">All emails comply with the CAN-SPAM Act and include:</p>
                  <ul className="list-disc list-inside space-y-3 ml-4 text-base md:text-lg">
                    <li>Clear identification of the sender (the contractor or JobDock)</li>
                    <li>Accurate subject lines that reflect the email content</li>
                    <li>Physical business address in the email footer</li>
                    <li>Clear indication of the business nature of the communication</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    4. Email Deliverability
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    We use industry-standard email infrastructure with authentication protocols (SPF, DKIM) to ensure reliable delivery and protect against spoofing. Invalid email addresses and delivery issues are automatically tracked to maintain high deliverability rates.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    5. Your Responsibilities as a User
                  </h2>
                  <p className="mb-4 text-base md:text-lg leading-relaxed">When using JobDock, you agree to:</p>
                  <ul className="list-disc list-inside space-y-3 ml-4 text-base md:text-lg">
                    <li>Only send emails to clients with whom you have a legitimate business relationship</li>
                    <li>Never use purchased or third-party email lists</li>
                    <li>Provide accurate business information in all communications</li>
                    <li>Respond promptly to client inquiries</li>
                    <li>Comply with all applicable anti-spam laws</li>
                  </ul>
                  <p className="mt-4 text-sm md:text-base text-primary-dark/70">
                    Violation of these policies may result in account suspension or termination. See our{' '}
                    <Link to="/terms" className="text-primary-gold hover:text-primary-gold/80 underline transition-colors font-semibold">
                      Terms of Service
                    </Link>{' '}
                    for details.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    6. Reporting Issues
                  </h2>
                  <p className="mb-4 text-base md:text-lg leading-relaxed">
                    If you receive an email from JobDock that you believe is inappropriate or violates our policies, please contact us immediately. We take all reports seriously and investigate promptly.
                  </p>
                  <div className="bg-primary-light border-2 border-primary-gold/20 rounded-xl p-6">
                    <p className="mb-3 text-base md:text-lg">
                      <strong className="text-primary-dark">Email:</strong>{' '}
                      <a
                        href={`mailto:${publicSiteConfig.supportEmail}`}
                        className="text-primary-gold hover:text-primary-gold/80 transition-colors font-semibold"
                      >
                        {publicSiteConfig.supportEmail}
                      </a>
                    </p>
                    <p className="text-base md:text-lg">
                      <strong className="text-primary-dark">Address:</strong> {getFormattedAddress()}
                    </p>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    7. Changes to This Policy
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    We may update this Email Communication Policy to reflect changes in our practices or legal requirements. Material changes will be communicated via email or through the service.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    8. Contact Us
                  </h2>
                  <p className="mb-4 text-base md:text-lg leading-relaxed">
                    Questions about this policy? We're here to help.
                  </p>
                  <div className="bg-primary-light border-2 border-primary-gold/20 rounded-xl p-6">
                    <p className="mb-3 text-base md:text-lg">
                      <strong className="text-primary-dark">Email:</strong>{' '}
                      <a
                        href={`mailto:${publicSiteConfig.supportEmail}`}
                        className="text-primary-gold hover:text-primary-gold/80 transition-colors font-semibold"
                      >
                        {publicSiteConfig.supportEmail}
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

export default EmailPolicyPage
