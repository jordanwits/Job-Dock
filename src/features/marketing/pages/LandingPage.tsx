import { Link } from 'react-router-dom'
import MarketingLayout from '../components/MarketingLayout'

const LandingPage = () => {
  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-dark via-primary-dark-secondary to-primary-blue pt-36 pb-16 md:pt-44 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-grid-white"></div>
        </div>
        <div className="container mx-auto px-4 md:px-6 relative">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left Column - Content */}
              <div className="text-center lg:text-left">
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-primary-light mb-6 leading-tight">
                  Manage Your Contracting Business with{' '}
                  <span className="text-primary-gold">Confidence</span>
                </h1>
                <p className="text-lg md:text-xl lg:text-2xl text-primary-light/80 mb-8 leading-relaxed">
                  Professional quotes, invoices, scheduling, and client management—all in one powerful platform built for service contractors.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <Link to="/auth/register">
                    <button className="group px-8 py-4 bg-primary-gold hover:bg-primary-gold/90 text-primary-dark font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 text-lg">
                      Start Free Trial
                      <svg className="inline-block ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  </Link>
                  <Link to="/auth/login">
                    <button className="px-8 py-4 bg-white hover:bg-primary-light text-primary-dark font-semibold rounded-xl border-2 border-primary-light hover:scale-105 transition-all duration-200 text-lg">
                      Sign In
                    </button>
                  </Link>
                </div>
                <p className="mt-6 text-sm text-primary-light/60">Free 14-day trial</p>
              </div>

              {/* Right Column - Image */}
              <div className="relative">
                <div className="relative rounded-3xl overflow-hidden border-2 border-primary-gold/20 shadow-2xl">
                  {/* Gradient overlay for cohesion */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-dark/20 via-transparent to-primary-blue/10 z-10 pointer-events-none"></div>
                  <img 
                    src="/marketing/hero-contractor.svg" 
                    alt="Contractor managing business with JobDock on tablet"
                    className="w-full h-auto"
                    loading="eager"
                  />
                </div>
                {/* Decorative accent */}
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary-gold/20 rounded-full blur-3xl"></div>
                <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary-blue/20 rounded-full blur-3xl"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-28 bg-primary-light">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 bg-primary-gold/10 text-primary-gold text-sm font-semibold rounded-full mb-4">
              FEATURES
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-primary-dark mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-primary-dark/70 max-w-2xl mx-auto">
              Powerful tools designed specifically for contractors and service professionals
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {/* Feature 1 */}
            <div className="bg-white border-2 border-primary-blue/20 rounded-2xl p-8 shadow-lg">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-blue to-primary-dark-secondary rounded-xl flex items-center justify-center mb-5 shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-primary-dark mb-3">Professional Quotes & Invoices</h3>
              <p className="text-primary-dark/70 leading-relaxed">
                Create polished quotes and invoices in seconds. Auto-send via email with PDF attachments and tracking.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white border-2 border-primary-blue/20 rounded-2xl p-8 shadow-lg">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-blue to-primary-dark-secondary rounded-xl flex items-center justify-center mb-5 shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-primary-dark mb-3">Smart Scheduling</h3>
              <p className="text-primary-dark/70 leading-relaxed">
                Manage your calendar with ease. Let clients book appointments online with automatic confirmation emails.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white border-2 border-primary-blue/20 rounded-2xl p-8 shadow-lg">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-blue to-primary-dark-secondary rounded-xl flex items-center justify-center mb-5 shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-primary-dark mb-3">Client Relationship Management</h3>
              <p className="text-primary-dark/70 leading-relaxed">
                Keep all client details, communication history, and project notes organized in one central hub.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white border-2 border-primary-blue/20 rounded-2xl p-8 shadow-lg">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-blue to-primary-dark-secondary rounded-xl flex items-center justify-center mb-5 shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-primary-dark mb-3">Automated Notifications</h3>
              <p className="text-primary-dark/70 leading-relaxed">
                Keep clients in the loop with automatic email updates for quotes, invoices, bookings, and job status changes.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white border-2 border-primary-blue/20 rounded-2xl p-8 shadow-lg">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-blue to-primary-dark-secondary rounded-xl flex items-center justify-center mb-5 shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-primary-dark mb-3">Job Tracking</h3>
              <p className="text-primary-dark/70 leading-relaxed">
                Monitor every job from quote to completion. Keep your team and clients informed with real-time status updates.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white border-2 border-primary-blue/20 rounded-2xl p-8 shadow-lg">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-blue to-primary-dark-secondary rounded-xl flex items-center justify-center mb-5 shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-primary-dark mb-3">Custom Branding</h3>
              <p className="text-primary-dark/70 leading-relaxed">
                Add your logo, colors, and business details. All documents and emails reflect your professional brand.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Industries Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 bg-primary-gold/10 text-primary-gold text-sm font-semibold rounded-full mb-4">
              WHO WE SERVE
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-primary-dark mb-4">
              Built for Service Professionals
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
            {[
              'Roofing', 'Plumbing', 'HVAC', 'Electrical',
              'Landscaping', 'Painting', 'Fencing', 'Handyman',
              'Cleaning', 'Carpentry', 'Flooring', 'Masonry'
            ].map((industry) => (
              <div
                key={industry}
                className="bg-white border-2 border-primary-blue/20 rounded-xl py-4 px-4 text-center hover:border-primary-gold hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <span className="text-sm font-semibold text-primary-dark">{industry}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Support & Peace of Mind Section */}
      <section className="py-20 md:py-24 bg-gradient-to-br from-primary-dark/5 to-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left Column - Image */}
              <div className="order-2 lg:order-1 relative">
                <div className="relative rounded-3xl overflow-hidden border-2 border-primary-blue/20 shadow-2xl">
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-blue/10 via-transparent to-primary-dark/5 z-10 pointer-events-none"></div>
                  <img 
                    src="/marketing/team-planning.svg" 
                    alt="Team of contractors collaborating and planning projects"
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
                {/* Decorative accents */}
                <div className="absolute -top-6 -left-6 w-28 h-28 bg-primary-gold/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-6 -right-6 w-36 h-36 bg-primary-blue/10 rounded-full blur-3xl"></div>
              </div>

              {/* Right Column - Content */}
              <div className="order-1 lg:order-2">
                <div className="inline-block px-4 py-1.5 bg-primary-gold/10 text-primary-gold text-sm font-semibold rounded-full mb-4">
                  BUILT FOR YOU
                </div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-dark mb-6 leading-tight">
                  Focus on What You Do Best—<span className="text-primary-gold">We'll Handle the Rest</span>
                </h2>
                <p className="text-lg md:text-xl text-primary-dark/70 mb-8 leading-relaxed">
                  Running a contracting business is demanding. Between job sites, client calls, and managing your team, the last thing you need is complicated software slowing you down.
                </p>
                
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary-gold/10 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-primary-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-primary-dark mb-1">Simple & Intuitive</h3>
                      <p className="text-primary-dark/70">Designed for busy contractors, not tech experts. Get up and running in minutes, not days.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary-blue/10 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-primary-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-primary-dark mb-1">Real Support, Real People</h3>
                      <p className="text-primary-dark/70">Questions? We're here to help. Get answers from people who understand your business.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary-dark/10 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-primary-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-primary-dark mb-1">Save Hours Every Week</h3>
                      <p className="text-primary-dark/70">Automate the paperwork and get back to doing what you love—growing your business.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 md:py-28 bg-gradient-to-br from-primary-blue/10 to-primary-light">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 bg-primary-gold/10 text-primary-gold text-sm font-semibold rounded-full mb-4">
              PROCESS
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-primary-dark mb-4">
              Start in <span className="text-primary-gold">Minutes</span>
            </h2>
            <p className="text-xl text-primary-dark/70 max-w-2xl mx-auto">
              Get your business up and running in four simple steps
            </p>
          </div>

          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8">
              {/* Step 1 */}
              <div className="text-center">
                <div className="relative mx-auto w-20 h-20 bg-gradient-to-br from-primary-blue to-primary-dark-secondary rounded-full flex items-center justify-center mb-6 shadow-lg">
                  <span className="text-3xl font-bold text-white">1</span>
                  {/* Connector line */}
                  <div className="hidden md:block absolute top-10 left-full w-full h-0.5 border-t-2 border-dashed border-primary-blue/30"></div>
                </div>
                <h3 className="text-lg font-bold text-primary-dark mb-2">Create Account</h3>
                <p className="text-primary-dark/70 text-sm">
                  Sign up in 30 seconds. Add your company details and branding.
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center">
                <div className="relative mx-auto w-20 h-20 bg-gradient-to-br from-primary-blue to-primary-dark-secondary rounded-full flex items-center justify-center mb-6 shadow-lg">
                  <span className="text-3xl font-bold text-white">2</span>
                  <div className="hidden md:block absolute top-10 left-full w-full h-0.5 border-t-2 border-dashed border-primary-blue/30"></div>
                </div>
                <h3 className="text-lg font-bold text-primary-dark mb-2">Add Clients & Services</h3>
                <p className="text-primary-dark/70 text-sm">
                  Import your existing clients or add them as you go.
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center">
                <div className="relative mx-auto w-20 h-20 bg-gradient-to-br from-primary-blue to-primary-dark-secondary rounded-full flex items-center justify-center mb-6 shadow-lg">
                  <span className="text-3xl font-bold text-white">3</span>
                  <div className="hidden md:block absolute top-10 left-full w-full h-0.5 border-t-2 border-dashed border-primary-blue/30"></div>
                </div>
                <h3 className="text-lg font-bold text-primary-dark mb-2">Send Your First Quote</h3>
                <p className="text-primary-dark/70 text-sm">
                  Create and send professional quotes instantly via email.
                </p>
              </div>

              {/* Step 4 */}
              <div className="text-center">
                <div className="relative mx-auto w-20 h-20 bg-gradient-to-br from-primary-blue to-primary-dark-secondary rounded-full flex items-center justify-center mb-6 shadow-lg">
                  <span className="text-3xl font-bold text-white">4</span>
                </div>
                <h3 className="text-lg font-bold text-primary-dark mb-2">Grow Your Business</h3>
                <p className="text-primary-dark/70 text-sm">
                  Focus on the work. Let JobDock handle the paperwork.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 md:py-32 bg-gradient-to-br from-primary-dark via-primary-dark-secondary to-primary-blue text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-grid-white"></div>
        </div>
        <div className="container mx-auto px-4 md:px-6 relative text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            Ready to Make Your Business{' '}
            <span className="text-primary-gold">Run Smoother?</span>
          </h2>
          <p className="text-xl text-white/90 mb-4 max-w-2xl mx-auto leading-relaxed">
            Start your free trial today—no credit card required. See why contractors love having more time to focus on what matters.
          </p>
          <p className="text-lg text-white/70 mb-10 max-w-xl mx-auto">
            Set up takes minutes. Cancel anytime. We're here to help every step of the way.
          </p>
          <Link to="/auth/register">
            <button className="group px-10 py-5 bg-primary-gold hover:bg-primary-gold/90 text-primary-dark font-bold rounded-xl shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-200 text-lg">
              Start Your Free Trial
              <svg className="inline-block ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </Link>
          <p className="mt-6 text-sm text-white/60">14-day trial • No credit card • Full access to all features</p>
        </div>
      </section>
    </MarketingLayout>
  )
}

export default LandingPage
