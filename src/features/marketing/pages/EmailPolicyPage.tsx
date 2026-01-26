import { Link } from 'react-router-dom'
import MarketingLayout from '../components/MarketingLayout'
import { publicSiteConfig, getFormattedAddress } from '../content/publicSiteConfig'

const EmailPolicyPage = () => {
  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold text-primary-dark mb-4">Email Communication Policy</h1>
        <p className="text-primary-dark/60 mb-8">
          Last Updated: January {publicSiteConfig.copyrightYear}
        </p>

        <div className="space-y-8 text-primary-dark/80">
          <section>
            <h2 className="text-2xl font-semibold text-primary-dark mb-4">Overview</h2>
            <p>
              JobDock is committed to responsible email communication. This policy explains what emails we send, who receives them, and how we maintain compliance with email regulations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-dark mb-4">
              1. Types of Emails We Send
            </h2>
            <p className="mb-4">
              JobDock sends only transactional emails related to business operations. We do not send marketing emails, newsletters, or promotional content.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white border border-primary-blue/20 rounded-lg p-5">
                <h3 className="text-base font-semibold text-primary-dark mb-2">
                  Quotes & Invoices
                </h3>
                <p className="text-sm text-primary-dark/70">
                  Automatic notifications when contractors send quotes or invoices, including PDF attachments.
                </p>
              </div>

              <div className="bg-white border border-primary-blue/20 rounded-lg p-5">
                <h3 className="text-base font-semibold text-primary-dark mb-2">
                  Booking Confirmations
                </h3>
                <p className="text-sm text-primary-dark/70">
                  Confirmation emails when clients book appointments, including details and options to manage bookings.
                </p>
              </div>

              <div className="bg-white border border-primary-blue/20 rounded-lg p-5">
                <h3 className="text-base font-semibold text-primary-dark mb-2">
                  Job Updates
                </h3>
                <p className="text-sm text-primary-dark/70">
                  Status notifications when job progress changes, keeping clients informed throughout the process.
                </p>
              </div>

              <div className="bg-white border border-primary-blue/20 rounded-lg p-5">
                <h3 className="text-base font-semibold text-primary-dark mb-2">
                  Account Notifications
                </h3>
                <p className="text-sm text-primary-dark/70">
                  Essential account updates, security alerts, and service-related communications.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-dark mb-4">
              2. Who Receives Emails
            </h2>
            <p className="mb-4">Emails are sent only to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                <strong>Business Users:</strong> Contractors who create JobDock accounts to manage their business
              </li>
              <li>
                <strong>Their Clients:</strong> Customers who book services, request quotes, or receive invoices from JobDock users
              </li>
            </ul>
            <p className="mt-4 font-semibold text-gray-900">
              We never:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Purchase, rent, or use third-party email lists</li>
              <li>Send unsolicited bulk emails or spam</li>
              <li>Share your email address with third parties for marketing</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-dark mb-4">
              3. CAN-SPAM Compliance
            </h2>
            <p className="mb-4">All emails comply with the CAN-SPAM Act and include:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Clear identification of the sender (the contractor or JobDock)</li>
              <li>Accurate subject lines that reflect the email content</li>
              <li>Physical business address in the email footer</li>
              <li>Clear indication of the business nature of the communication</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-dark mb-4">
              4. Email Deliverability
            </h2>
            <p className="mb-4">
              We use industry-standard email infrastructure with authentication protocols (SPF, DKIM) to ensure reliable delivery and protect against spoofing. Invalid email addresses and delivery issues are automatically tracked to maintain high deliverability rates.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-dark mb-4">
              5. Your Responsibilities as a User
            </h2>
            <p className="mb-4">When using JobDock, you agree to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Only send emails to clients with whom you have a legitimate business relationship</li>
              <li>Never use purchased or third-party email lists</li>
              <li>Provide accurate business information in all communications</li>
              <li>Respond promptly to client inquiries</li>
              <li>Comply with all applicable anti-spam laws</li>
            </ul>
            <p className="mt-4 text-sm">
              Violation of these policies may result in account suspension or termination. See our{' '}
              <Link to="/terms" className="text-primary-gold hover:text-primary-gold/80 underline transition-colors">
                Terms of Service
              </Link>{' '}
              for details.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-dark mb-4">
              6. Reporting Issues
            </h2>
            <p className="mb-4">
              If you receive an email from JobDock that you believe is inappropriate or violates our policies, please contact us immediately. We take all reports seriously and investigate promptly.
            </p>
            <div className="bg-white border border-primary-blue/20 rounded-lg p-4">
              <p className="mb-2">
                <strong>Email:</strong>{' '}
                <a
                  href={`mailto:${publicSiteConfig.supportEmail}`}
                  className="text-primary-gold hover:text-primary-gold/80 transition-colors"
                >
                  {publicSiteConfig.supportEmail}
                </a>
              </p>
              <p>
                <strong>Address:</strong> {getFormattedAddress()}
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-dark mb-4">
              7. Changes to This Policy
            </h2>
            <p>
              We may update this Email Communication Policy to reflect changes in our practices or legal requirements. Material changes will be communicated via email or through the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-dark mb-4">8. Contact Us</h2>
            <p className="mb-2">
              Questions about this policy? We're here to help.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
              <p className="mb-2">
                <strong>Email:</strong>{' '}
                <a
                  href={`mailto:${publicSiteConfig.supportEmail}`}
                  className="text-primary-gold hover:text-primary-gold/80 transition-colors"
                >
                  {publicSiteConfig.supportEmail}
                </a>
              </p>
              <p>
                <strong>Address:</strong> {getFormattedAddress()}
              </p>
            </div>
          </section>
        </div>
      </div>
    </MarketingLayout>
  )
}

export default EmailPolicyPage
