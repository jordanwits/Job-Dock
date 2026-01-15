import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import MarketingLayout from '../components/MarketingLayout'
import { publicSiteConfig } from '../content/publicSiteConfig'

const LandingPage = () => {
  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-primary-light mb-6">
            Complete Contractor Management Platform
          </h1>
          <p className="text-xl md:text-2xl text-primary-light/80 mb-8">
            Streamline your service business with quotes, invoices, bookings, and automated
            notifications—all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth/register">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                Get Started Free
              </Button>
            </Link>
            <Link to="/auth/login">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-light text-center mb-12">
            Everything You Need to Run Your Business
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-primary-dark-secondary border border-primary-blue rounded-lg p-6">
              <div className="w-12 h-12 bg-primary-gold/20 rounded-lg flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-primary-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary-light mb-2">Quotes & Invoices</h3>
              <p className="text-primary-light/70">
                Create professional quotes and invoices in minutes. Clients receive instant email
                notifications with PDF attachments.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-primary-dark-secondary border border-primary-blue rounded-lg p-6">
              <div className="w-12 h-12 bg-primary-gold/20 rounded-lg flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-primary-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary-light mb-2">
                Booking & Scheduling
              </h3>
              <p className="text-primary-light/70">
                Let clients book appointments online. Manage your calendar and send automated
                booking confirmations.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-primary-dark-secondary border border-primary-blue rounded-lg p-6">
              <div className="w-12 h-12 bg-primary-gold/20 rounded-lg flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-primary-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary-light mb-2">CRM & Contacts</h3>
              <p className="text-primary-light/70">
                Manage all your customer relationships in one place. Track communications, projects,
                and payment history.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-primary-dark-secondary border border-primary-blue rounded-lg p-6">
              <div className="w-12 h-12 bg-primary-gold/20 rounded-lg flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-primary-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary-light mb-2">
                Email Notifications
              </h3>
              <p className="text-primary-light/70">
                Automated transactional emails keep your clients informed about quotes, invoices,
                and bookings.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-primary-dark-secondary border border-primary-blue rounded-lg p-6">
              <div className="w-12 h-12 bg-primary-gold/20 rounded-lg flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-primary-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary-light mb-2">Job Tracking</h3>
              <p className="text-primary-light/70">
                Monitor job status from quote to completion. Keep clients updated with automatic
                status notifications.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-primary-dark-secondary border border-primary-blue rounded-lg p-6">
              <div className="w-12 h-12 bg-primary-gold/20 rounded-lg flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-primary-gold"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-primary-light mb-2">
                Customizable Branding
              </h3>
              <p className="text-primary-light/70">
                Add your company logo and customize email templates to match your brand identity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Email Transparency Section */}
      <section className="container mx-auto px-4 py-16 md:py-24 bg-primary-dark-secondary/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-light text-center mb-6">
            How JobDock Emails Work
          </h2>
          <p className="text-lg text-primary-light/80 text-center mb-12">
            We believe in transparency. Here's exactly how we handle email communications.
          </p>

          <div className="space-y-6">
            <div className="bg-primary-dark-secondary border border-primary-blue rounded-lg p-6">
              <h3 className="text-xl font-semibold text-primary-gold mb-3">
                Transactional Emails Only
              </h3>
              <p className="text-primary-light/70">
                JobDock sends only transactional emails triggered by user actions: invoice
                notifications when you invoice a client, quote notifications when you respond to a
                service request, booking confirmations when a client books an appointment, and job
                status updates. We never send marketing emails or promotional content.
              </p>
            </div>

            <div className="bg-primary-dark-secondary border border-primary-blue rounded-lg p-6">
              <h3 className="text-xl font-semibold text-primary-gold mb-3">Who Receives Emails</h3>
              <p className="text-primary-light/70">
                Only users who explicitly created accounts or customers who booked services through
                your booking page receive emails. We never use purchased email lists or send
                unsolicited emails. All emails are one-to-one transactional communications between
                you and your clients.
              </p>
            </div>

            <div className="bg-primary-dark-secondary border border-primary-blue rounded-lg p-6">
              <h3 className="text-xl font-semibold text-primary-gold mb-3">Email Management</h3>
              <p className="text-primary-light/70">
                Every email includes clear sender identification and contact information. Clients
                can manage their communication preferences, and all emails comply with CAN-SPAM Act
                requirements including our physical business address.
              </p>
            </div>

            <div className="bg-primary-dark-secondary border border-primary-blue rounded-lg p-6">
              <h3 className="text-xl font-semibold text-primary-gold mb-3">Questions or Issues?</h3>
              <p className="text-primary-light/70 mb-4">
                If you have questions about our email practices or need to report an issue, please
                contact us at{' '}
                <a
                  href={`mailto:${publicSiteConfig.supportEmail}`}
                  className="text-primary-gold hover:text-primary-light transition-colors underline"
                >
                  {publicSiteConfig.supportEmail}
                </a>
                . For more details, see our{' '}
                <Link to="/email-policy" className="text-primary-gold hover:text-primary-light transition-colors underline">
                  Email Policy
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-light mb-6">
            Ready to streamline your business?
          </h2>
          <p className="text-xl text-primary-light/80 mb-8">
            Join service providers who trust JobDock to manage their quotes, invoices, and bookings.
          </p>
          <Link to="/auth/register">
            <Button variant="primary" size="lg">
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>
    </MarketingLayout>
  )
}

export default LandingPage
