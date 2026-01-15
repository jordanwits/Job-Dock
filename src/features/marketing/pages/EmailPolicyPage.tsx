import { Link } from 'react-router-dom'
import MarketingLayout from '../components/MarketingLayout'
import { publicSiteConfig, getFormattedAddress } from '../content/publicSiteConfig'

const EmailPolicyPage = () => {
  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold text-primary-light mb-4">Email Policy</h1>
        <p className="text-primary-light/70 mb-8">
          Last Updated: January {publicSiteConfig.copyrightYear}
        </p>

        <div className="space-y-8 text-primary-light/80">
          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">Overview</h2>
            <p>
              JobDock is committed to responsible email practices. This policy explains how we send
              emails, who receives them, and how we handle email deliverability and compliance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">
              1. Types of Emails We Send
            </h2>
            <p className="mb-4">
              JobDock sends only transactional emails triggered by specific user actions. We do not
              send marketing emails, newsletters, or promotional content. All emails are one-to-one
              communications.
            </p>

            <div className="bg-primary-dark-secondary border border-primary-blue rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-primary-gold mb-2">
                  Invoice Notifications
                </h3>
                <p className="text-sm">
                  Sent when a contractor creates and sends an invoice to a client. Includes invoice
                  details, amount due, due date, and PDF attachment.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-primary-gold mb-2">
                  Quote Notifications
                </h3>
                <p className="text-sm">
                  Sent when a contractor responds to a service request with a quote. Includes
                  pricing, service details, validity period, and accept/decline options.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-primary-gold mb-2">
                  Booking Confirmations
                </h3>
                <p className="text-sm">
                  Sent when a client books an appointment through a contractor's booking page.
                  Includes appointment date, time, location, and reschedule/cancel options.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-primary-gold mb-2">
                  Job Status Updates
                </h3>
                <p className="text-sm">
                  Sent when a job status changes (scheduled, in progress, completed). Keeps clients
                  informed about their service requests.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">
              2. Who Receives Emails
            </h2>
            <p className="mb-4">Emails are sent only to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                <strong>Registered Account Holders:</strong> Users who explicitly created a JobDock
                account for their contracting business
              </li>
              <li>
                <strong>Service Customers:</strong> Clients who booked services through a
                contractor's public booking page or received quotes/invoices from a JobDock user
              </li>
            </ul>
            <p className="mt-4">
              <strong>We never:</strong>
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Use purchased, rented, or third-party email lists</li>
              <li>Send unsolicited bulk emails or spam</li>
              <li>Share email addresses with third parties for marketing purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">
              3. Email Volume and Frequency
            </h2>
            <p>
              Current volume: 50-100 emails per day
              <br />
              Expected growth: 200-500 emails per day within 6 months
              <br />
              <br />
              Email frequency is entirely based on business activity—there are no scheduled
              campaigns or recurring marketing messages.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">
              4. Recipient Management
            </h2>
            <p className="mb-4">We take recipient consent and preferences seriously:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                All emails are triggered by explicit actions (sending an invoice, booking a
                service, etc.)
              </li>
              <li>Recipients have an existing business relationship with the sending contractor</li>
              <li>
                Users can manage email preferences in their account settings (for account holders)
              </li>
              <li>Clear contact information is provided in every email</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">
              5. Email Deliverability Management
            </h2>
            <p className="mb-4">JobDock uses AWS Simple Email Service (SES) for email delivery.</p>

            <div className="bg-primary-dark-secondary border border-primary-blue rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-primary-gold mb-2">
                  Bounce Handling
                </h3>
                <p className="text-sm">
                  Hard bounces (invalid email addresses) are tracked and marked in our database to
                  prevent future sending attempts. Soft bounces (temporary delivery issues) are
                  monitored and retried with exponential backoff.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-primary-gold mb-2">
                  Complaint Handling
                </h3>
                <p className="text-sm">
                  Any spam complaints are taken seriously. Email addresses that generate complaints
                  are immediately flagged in our system, and we investigate the source of the
                  complaint to ensure policy compliance.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-primary-gold mb-2">
                  Suppression List
                </h3>
                <p className="text-sm">
                  We maintain an internal suppression list in our PostgreSQL database for
                  recipients who have opted out or generated bounce/complaint events. This list is
                  checked before every email send.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">
              6. Domain and Authentication
            </h2>
            <div className="bg-primary-dark-secondary border border-primary-blue rounded-lg p-4">
              <p className="mb-2">
                <strong>Verified Domain:</strong> thejobdock.com
              </p>
              <p className="mb-2">
                <strong>From Address:</strong> {publicSiteConfig.fromEmail}
              </p>
              <p className="mb-2">
                <strong>DKIM:</strong> Enabled
              </p>
              <p className="mb-2">
                <strong>SPF:</strong> Configured
              </p>
              <p>
                <strong>Domain Verification Date:</strong> January 12, 2026
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">7. CAN-SPAM Compliance</h2>
            <p className="mb-4">All emails sent through JobDock comply with the CAN-SPAM Act:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Clear and accurate "From" information identifying the sender</li>
              <li>Accurate subject lines that reflect email content</li>
              <li>Physical business address included in email footers</li>
              <li>Clear indication that the message is a business communication</li>
              <li>Immediate processing of opt-out requests</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">
              8. Reporting Issues
            </h2>
            <p className="mb-4">
              If you receive an email from JobDock that you believe is inappropriate, spam, or
              violates our policies, please contact us immediately:
            </p>
            <div className="bg-primary-dark-secondary border border-primary-blue rounded-lg p-4">
              <p className="mb-2">
                <strong>Email:</strong>{' '}
                <a
                  href={`mailto:${publicSiteConfig.supportEmail}`}
                  className="text-primary-blue hover:text-primary-gold transition-colors"
                >
                  {publicSiteConfig.supportEmail}
                </a>
              </p>
              <p>
                <strong>Address:</strong> {getFormattedAddress()}
              </p>
            </div>
            <p className="mt-4">
              We investigate all reports promptly and take appropriate action, including account
              suspension if policy violations are confirmed.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">
              9. User Responsibilities
            </h2>
            <p className="mb-4">JobDock users agree to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                Only send emails to recipients with whom they have a legitimate business
                relationship
              </li>
              <li>Never use purchased or third-party email lists</li>
              <li>Provide accurate business information in all communications</li>
              <li>Respond promptly to customer inquiries and complaints</li>
              <li>Comply with all applicable email and anti-spam laws</li>
            </ul>
            <p className="mt-4">
              Users who violate these policies may have their accounts suspended or terminated. See
              our{' '}
              <Link to="/terms" className="text-primary-blue hover:text-primary-gold transition-colors">
                Terms of Service
              </Link>{' '}
              for more details.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">
              10. Changes to This Policy
            </h2>
            <p>
              We may update this Email Policy from time to time to reflect changes in our practices
              or legal requirements. We will notify users of material changes via email or through
              the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">11. Contact Us</h2>
            <p className="mb-2">
              Questions about this Email Policy? Contact us:
            </p>
            <div className="bg-primary-dark-secondary border border-primary-blue rounded-lg p-4 mt-4">
              <p className="mb-2">
                <strong>Email:</strong>{' '}
                <a
                  href={`mailto:${publicSiteConfig.supportEmail}`}
                  className="text-primary-blue hover:text-primary-gold transition-colors"
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
