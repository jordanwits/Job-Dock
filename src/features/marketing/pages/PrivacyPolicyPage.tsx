import MarketingLayout from '../components/MarketingLayout'
import { publicSiteConfig, getFormattedAddress } from '../content/publicSiteConfig'

const PrivacyPolicyPage = () => {
  return (
    <MarketingLayout>
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold text-primary-light mb-4">Privacy Policy</h1>
        <p className="text-primary-light/70 mb-8">
          Last Updated: January {publicSiteConfig.copyrightYear}
        </p>

        <div className="space-y-8 text-primary-light/80">
          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">
              1. Information We Collect
            </h2>
            <p className="mb-4">
              When you use JobDock, we collect information that you provide directly to us:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                <strong>Account Information:</strong> Name, email address, company name, and
                password when you create an account
              </li>
              <li>
                <strong>Business Information:</strong> Company details, logo, contact information,
                and business preferences
              </li>
              <li>
                <strong>Customer Data:</strong> Contact information for your clients (names, email
                addresses, phone numbers, addresses)
              </li>
              <li>
                <strong>Transaction Data:</strong> Quotes, invoices, bookings, and related business
                documents
              </li>
              <li>
                <strong>Usage Data:</strong> Information about how you use our service, including
                access times and features used
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">
              2. How We Use Your Information
            </h2>
            <p className="mb-4">We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide, maintain, and improve our services</li>
              <li>Send transactional emails (quotes, invoices, booking confirmations)</li>
              <li>Process and manage your account</li>
              <li>Respond to your support requests and communications</li>
              <li>Ensure the security and integrity of our services</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">
              3. Information Sharing and Disclosure
            </h2>
            <p className="mb-4">
              We do not sell or rent your personal information to third parties. We may share your
              information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                <strong>With Your Clients:</strong> When you send quotes, invoices, or booking
                confirmations to your clients
              </li>
              <li>
                <strong>Service Providers:</strong> With third-party vendors who help us provide our
                services (e.g., AWS for hosting, email delivery)
              </li>
              <li>
                <strong>Legal Requirements:</strong> When required by law or to protect our rights
                and safety
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">4. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your data, including
              encryption, secure authentication, and regular security audits. However, no method of
              transmission over the internet is 100% secure, and we cannot guarantee absolute
              security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">5. Data Retention</h2>
            <p>
              We retain your account information and business data for as long as your account is
              active or as needed to provide you services. You may request deletion of your account
              and data at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">6. Your Rights</h2>
            <p className="mb-4">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Access and review your personal information</li>
              <li>Correct or update your information</li>
              <li>Delete your account and associated data</li>
              <li>Export your data</li>
              <li>Opt out of non-essential communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">
              7. Cookies and Tracking
            </h2>
            <p>
              We use essential cookies to maintain your session and remember your preferences. We do
              not use advertising or tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">
              8. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any
              material changes by posting the new policy on this page and updating the "Last
              Updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-light mb-4">9. Contact Us</h2>
            <p className="mb-2">If you have questions about this Privacy Policy, please contact us:</p>
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

export default PrivacyPolicyPage
