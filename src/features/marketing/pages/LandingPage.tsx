import MarketingLayout from '../components/MarketingLayout'
import MarketingSection from '../components/MarketingSection'
import SectionHeading from '../components/SectionHeading'
import FeatureCard from '../components/FeatureCard'
import StatCard from '../components/StatCard'
import MarketingButton from '../components/MarketingButton'
import { landingPageContent } from '../content/landingPageContent'

const LandingPage = () => {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <MarketingSection variant="gradient-dark" className="pt-36 pb-16 md:pt-44 md:pb-24">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-blueprint-grid"></div>
        </div>
        <div className="container mx-auto px-4 md:px-6 relative">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left Column - Content */}
              <div className="text-center lg:text-left animate-fade-in-up">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-primary-light mb-6 leading-tight">
                  {landingPageContent.hero.title.line1}
                  <br />
                  <span className="text-primary-gold">{landingPageContent.hero.title.line2}</span>
                </h1>
                <p className="text-lg md:text-xl lg:text-2xl text-primary-light/90 mb-6 leading-relaxed">
                  {landingPageContent.hero.subtitle}
                </p>
                <p className="text-base md:text-lg text-primary-light/80 mb-8 leading-relaxed">
                  {landingPageContent.hero.description}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <MarketingButton to="/request-access" variant="primary" size="lg" withArrow>
                    {landingPageContent.hero.primaryCta}
                  </MarketingButton>
                  <MarketingButton
                    onClick={() => scrollToSection('how-it-works')}
                    variant="outline"
                    size="lg"
                  >
                    {landingPageContent.hero.secondaryCta}
                  </MarketingButton>
                </div>
              </div>

              {/* Right Column - Image */}
              <div className="relative animate-fade-in-up animation-delay-200">
                <div className="relative rounded-3xl overflow-hidden border-2 border-primary-gold/20 shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-dark/20 via-transparent to-primary-blue/10 z-10 pointer-events-none"></div>
                  <img
                    src="/marketing/hero-contractor.svg"
                    alt={landingPageContent.hero.imageAlt}
                    className="w-full h-auto"
                    loading="eager"
                  />
                </div>
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary-gold/20 rounded-full blur-3xl"></div>
                <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary-blue/20 rounded-full blur-3xl"></div>
              </div>
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* Trust Bar */}
      <MarketingSection variant="white" className="py-8 md:py-12 border-b border-primary-blue/10">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center">
              {landingPageContent.trustBar.map((item, index) => (
                <div
                  key={index}
                  className={`animate-fade-in-up ${index > 0 ? `animation-delay-${index}00` : ''}`}
                >
                  <div className="text-3xl md:text-4xl font-bold text-primary-gold mb-2">
                    {item.value}
                  </div>
                  <div className="text-sm md:text-base text-primary-dark/70">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* Value Proposition */}
      <MarketingSection variant="gradient-blue" className="py-12 md:py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12 md:mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-dark mb-4 leading-tight">
                You don't need another <span className="text-primary-gold">bloated platform.</span>
              </h2>
              <p className="text-xl md:text-2xl text-primary-dark/70 leading-relaxed">
                You need something that{' '}
                <span className="text-primary-gold font-semibold">actually fits how you work.</span>
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 md:gap-8">
              {landingPageContent.valueProposition.cards.map((card, index) => {
                const icons = [
                  <path
                    key={index}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />,
                  <path
                    key={index}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />,
                  <path
                    key={index}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />,
                ]
                const bgColors = ['bg-primary-gold/10', 'bg-primary-gold/10', 'bg-primary-gold/10']
                const iconColors = ['text-primary-gold', 'text-primary-gold', 'text-primary-gold']

                return (
                  <div key={index} className="text-center p-6">
                    <div
                      className={`w-16 h-16 mx-auto mb-4 ${bgColors[index]} rounded-full flex items-center justify-center`}
                    >
                      <svg
                        className={`w-8 h-8 ${iconColors[index]}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {icons[index]}
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-primary-dark mb-2">{card.title}</h3>
                    <p className="text-primary-dark/70">{card.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* Problem Section */}
      <MarketingSection variant="white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-dark mb-8 text-center leading-tight">
              Running your business shouldn't feel{' '}
              <span className="text-primary-gold">this complicated</span>
            </h2>
            <p className="text-lg md:text-xl text-primary-dark/70 mb-8 text-center">
              {landingPageContent.problem.subtitle}
            </p>
            <div className="space-y-4 mb-8 max-w-2xl mx-auto">
              {landingPageContent.problem.problems.map((problem, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 animate-fade-in-up ${index > 0 ? `animation-delay-${index}00` : ''}`}
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-gold/20 flex items-center justify-center mt-1">
                    <div className="w-2 h-2 rounded-full bg-primary-gold"></div>
                  </div>
                  <p className="text-lg text-primary-dark/80">{problem}</p>
                </div>
              ))}
            </div>
            <div className="text-center max-w-2xl mx-auto space-y-4 pt-8 border-t-2 border-primary-gold/20">
              <p className="text-xl text-primary-dark/80 font-bold">
                {landingPageContent.problem.conclusion.headline}
              </p>
              <p className="text-lg text-primary-dark/70">
                {landingPageContent.problem.conclusion.description}
              </p>
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* Features Grid */}
      <MarketingSection id="features" variant="gradient-dark">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12 md:mb-16">
            <div className="inline-block px-4 py-1.5 bg-primary-gold/10 text-primary-gold text-sm font-bold tracking-wider rounded-full mb-4 uppercase">
              {landingPageContent.features.eyebrow}
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
              Everything you need. <span className="text-primary-gold">Nothing you don't.</span>
            </h2>
            <p className="text-lg md:text-xl text-white/80 max-w-3xl mx-auto leading-relaxed">
              {landingPageContent.features.subtitle}
            </p>
          </div>
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            <FeatureCard
              variant="elevated"
              icon={
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
              }
              title="Professional Quotes"
              description="Create and send polished quotes in minutes. No design skills needed."
            />
            <FeatureCard
              variant="elevated"
              icon={
                <svg
                  className="w-6 h-6 text-primary-blue"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              }
              title="Fast Invoicing"
              description="Turn completed jobs into accurate invoices with one click."
            />
            <FeatureCard
              variant="elevated"
              icon={
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
              }
              title="Smart Scheduling"
              description="Manage bookings without double-booking. See your week at a glance."
            />
            <FeatureCard
              variant="elevated"
              icon={
                <svg
                  className="w-6 h-6 text-primary-blue"
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
              }
              title="Client Management"
              description="Keep all contact details, job history, and notes in one place."
            />
            <FeatureCard
              variant="elevated"
              icon={
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
              }
              title="Auto Email"
              description="Send quotes and invoices automatically. Professional and fast."
            />
            <FeatureCard
              variant="elevated"
              icon={
                <svg
                  className="w-6 h-6 text-primary-blue"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              }
              title="Job Tracking"
              description="Track progress from lead to completion. Never lose track of where you are."
            />
          </div>
        </div>
      </MarketingSection>

      {/* How It Works Section */}
      <MarketingSection id="how-it-works" variant="white" withTopDivider withBottomDivider>
        <div className="container mx-auto px-4 md:px-6">
          <SectionHeading
            eyebrow="How It Works"
            heading={
              <>
                From quote to invoice — <span className="text-primary-gold">without the chaos</span>
              </>
            }
          />

          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8">
              {/* Step 1 */}
              <div className="text-center animate-fade-in-up">
                <div className="relative mx-auto w-20 h-20 bg-gradient-to-br from-primary-blue to-primary-dark-secondary rounded-full flex items-center justify-center mb-6 shadow-lg">
                  <span className="text-3xl font-bold text-white">1</span>
                  <div className="hidden md:block absolute top-10 left-full w-full h-0.5 border-t-2 border-dashed border-primary-blue/30"></div>
                </div>
                <h3 className="text-lg font-bold text-primary-dark mb-2">Create a client</h3>
                <p className="text-primary-dark/70 text-sm">
                  Store contact details, job notes, and history in one place.
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center animate-fade-in-up animation-delay-100">
                <div className="relative mx-auto w-20 h-20 bg-gradient-to-br from-primary-blue to-primary-dark-secondary rounded-full flex items-center justify-center mb-6 shadow-lg">
                  <span className="text-3xl font-bold text-white">2</span>
                  <div className="hidden md:block absolute top-10 left-full w-full h-0.5 border-t-2 border-dashed border-primary-blue/30"></div>
                </div>
                <h3 className="text-lg font-bold text-primary-dark mb-2">Send a quote</h3>
                <p className="text-primary-dark/70 text-sm">
                  Build and send clear, professional quotes in minutes.
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center animate-fade-in-up animation-delay-200">
                <div className="relative mx-auto w-20 h-20 bg-gradient-to-br from-primary-blue to-primary-dark-secondary rounded-full flex items-center justify-center mb-6 shadow-lg">
                  <span className="text-3xl font-bold text-white">3</span>
                  <div className="hidden md:block absolute top-10 left-full w-full h-0.5 border-t-2 border-dashed border-primary-blue/30"></div>
                </div>
                <h3 className="text-lg font-bold text-primary-dark mb-2">Schedule the job</h3>
                <p className="text-primary-dark/70 text-sm">
                  Book work directly on your calendar and stay organized.
                </p>
              </div>

              {/* Step 4 */}
              <div className="text-center animate-fade-in-up animation-delay-300">
                <div className="relative mx-auto w-20 h-20 bg-gradient-to-br from-primary-blue to-primary-dark-secondary rounded-full flex items-center justify-center mb-6 shadow-lg">
                  <span className="text-3xl font-bold text-white">4</span>
                </div>
                <h3 className="text-lg font-bold text-primary-dark mb-2">
                  Invoice with confidence
                </h3>
                <p className="text-primary-dark/70 text-sm">
                  Turn completed work into clean, accurate invoices — without starting over.
                </p>
              </div>
            </div>
            <div className="text-center mt-12 space-y-2">
              <p className="text-xl text-primary-dark/80 font-semibold">
                Everything stays connected.
              </p>
              <p className="text-xl text-primary-dark/80 font-semibold">
                Everything stays visible.
              </p>
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* Stats Band */}
      <MarketingSection variant="gradient-dark">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                Built for <span className="text-primary-gold">real work</span>
              </h2>
              <p className="text-lg md:text-xl text-white/80">
                The numbers that matter for service businesses
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 md:gap-8">
              <StatCard
                icon={
                  <svg
                    className="w-8 h-8 text-primary-gold"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                }
                value="3 min"
                label="Average Quote Time"
                description="From blank to sent"
              />
              <StatCard
                icon={
                  <svg
                    className="w-8 h-8 text-primary-gold"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                }
                value="1 click"
                label="Quote to Invoice"
                description="No re-entering data"
              />
              <StatCard
                icon={
                  <svg
                    className="w-8 h-8 text-primary-gold"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                }
                value="24/7"
                label="Client Booking"
                description="They book. You approve."
              />
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* Solution Section */}
      <MarketingSection id="benefits" variant="light">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-5xl mx-auto">
            <SectionHeading
              heading="The Job Dock brings it all together"
              subheading="A simple, focused tool designed around how service businesses actually operate."
            />
            <div className="bg-white border-2 border-primary-blue/20 rounded-2xl p-8 md:p-10 shadow-xl mb-8">
              <h3 className="text-xl md:text-2xl font-bold text-primary-dark mb-6">
                With The Job Dock, you can:
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-gold/10 rounded-lg flex items-center justify-center mt-0.5">
                    <svg
                      className="w-5 h-5 text-primary-gold"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-lg text-primary-dark/80">
                    Create and send professional quotes
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-gold/10 rounded-lg flex items-center justify-center mt-0.5">
                    <svg
                      className="w-5 h-5 text-primary-gold"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-lg text-primary-dark/80">Convert quotes into invoices</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-gold/10 rounded-lg flex items-center justify-center mt-0.5">
                    <svg
                      className="w-5 h-5 text-primary-gold"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-lg text-primary-dark/80">
                    Schedule jobs without double-booking
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-gold/10 rounded-lg flex items-center justify-center mt-0.5">
                    <svg
                      className="w-5 h-5 text-primary-gold"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-lg text-primary-dark/80">
                    Track clients, jobs, and status in one place
                  </p>
                </div>
                <div className="flex items-start gap-3 md:col-span-2">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-gold/10 rounded-lg flex items-center justify-center mt-0.5">
                    <svg
                      className="w-5 h-5 text-primary-gold"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-lg text-primary-dark/80">
                    Reduce admin without adding complexity
                  </p>
                </div>
              </div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-xl text-primary-dark/80 font-semibold">No learning curve.</p>
              <p className="text-xl text-primary-dark/80 font-semibold">No unnecessary features.</p>
              <p className="text-xl text-primary-dark/80 font-semibold">
                Just what you need — and nothing you don't.
              </p>
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* Why Different Section */}
      <MarketingSection id="why-us" variant="white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left Column - Image */}
              <div className="order-2 lg:order-1 relative">
                <div className="relative rounded-3xl overflow-hidden border-2 border-primary-blue/20 shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-blue/10 via-transparent to-primary-dark/5 z-10 pointer-events-none"></div>
                  <img
                    src="/marketing/team-planning.svg"
                    alt="Team of contractors collaborating and planning projects"
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
                <div className="absolute -top-6 -left-6 w-28 h-28 bg-primary-gold/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-6 -right-6 w-36 h-36 bg-primary-blue/10 rounded-full blur-3xl"></div>
              </div>

              {/* Right Column - Content */}
              <div className="order-1 lg:order-2">
                <SectionHeading
                  eyebrow="Why We're Different"
                  heading="Built for real people, not enterprise checklists"
                  subheading="Many tools try to be everything for everyone. The Job Dock is different."
                  align="left"
                />

                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary-gold/10 rounded-xl flex items-center justify-center">
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
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-primary-dark mb-1">
                        Simplicity over complexity
                      </h3>
                      <p className="text-primary-dark/70">
                        We strip away the bloat and focus on what actually matters.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary-gold/10 rounded-xl flex items-center justify-center">
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
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-primary-dark mb-1">
                        Clarity over feature overload
                      </h3>
                      <p className="text-primary-dark/70">
                        Every feature has a purpose. Nothing is there "just because."
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary-gold/10 rounded-xl flex items-center justify-center">
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
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-primary-dark mb-1">
                        Human workflows over rigid systems
                      </h3>
                      <p className="text-primary-dark/70">
                        Work the way you want to, not the way some software says you should.
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-lg text-primary-dark/80 mt-8 p-4 bg-white/50 border-l-4 border-primary-gold rounded italic">
                  If you've ever thought "this software is more work than it's worth" — this is for
                  you.
                </p>
              </div>
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* Early Access Section */}
      <MarketingSection id="early-access" variant="light" withTopDivider>
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <SectionHeading
              eyebrow="Early Access"
              heading="We're opening early access"
              subheading="The Job Dock is currently being used by a small group of service businesses helping shape the product through real-world feedback."
            />
            <div className="bg-white border-2 border-primary-blue/20 rounded-2xl p-8 md:p-10 shadow-xl mb-8">
              <h3 className="text-xl md:text-2xl font-bold text-primary-dark mb-6">If you want:</h3>
              <div className="space-y-4 text-left max-w-xl mx-auto">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-gold/10 rounded-lg flex items-center justify-center mt-0.5">
                    <svg
                      className="w-5 h-5 text-primary-gold"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-lg text-primary-dark/80">Early access to the platform</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-gold/10 rounded-lg flex items-center justify-center mt-0.5">
                    <svg
                      className="w-5 h-5 text-primary-gold"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-lg text-primary-dark/80">A voice in how the product evolves</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-gold/10 rounded-lg flex items-center justify-center mt-0.5">
                    <svg
                      className="w-5 h-5 text-primary-gold"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-lg text-primary-dark/80">A simpler way to run your business</p>
                </div>
              </div>
            </div>
            <p className="text-lg text-primary-dark/70 mb-8">We'd love to have you.</p>
            <MarketingButton to="/request-access" variant="primary" size="lg" withArrow>
              Request Early Access
            </MarketingButton>
          </div>
        </div>
      </MarketingSection>
    </MarketingLayout>
  )
}

export default LandingPage
