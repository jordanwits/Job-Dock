import { useEffect } from 'react'
import MarketingLayout from '../components/MarketingLayout'
import MarketingSection from '../components/MarketingSection'
import SectionHeading from '../components/SectionHeading'
import FeatureCard from '../components/FeatureCard'
import StatCard from '../components/StatCard'
import MarketingButton from '../components/MarketingButton'
import { landingPageContent } from '../content/landingPageContent'

const LandingPage = () => {
  // Scroll to section when navigating from another page with hash (e.g. /#features)
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) {
      const timer = setTimeout(() => {
        const element = document.getElementById(hash)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  return (
    <MarketingLayout>
      {/* Hero Section - Image background with overlay and liquid glass card */}
      <section className="relative min-h-[75vh] flex items-center pt-24 pb-12 lg:pt-28 lg:pb-16 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-no-repeat bg-[center_65%]"
          style={{ backgroundImage: 'url(/IMG_0547.jpeg)' }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-black/25" aria-hidden />
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="max-w-4xl mx-auto rounded-3xl border border-white/30 bg-black/20 backdrop-blur-md p-8 md:p-12 shadow-2xl shadow-black/10 text-center animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/15 border border-white/20 text-primary-gold text-sm font-semibold tracking-wide mb-8 hover:bg-black/25 transition-colors cursor-default">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-gold opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary-gold"></span>
              </span>
              Now in production
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight leading-[1.1]">
              {landingPageContent.hero.title.line1}
              <br />
              <span className="text-primary-gold">{landingPageContent.hero.title.line2}</span>
            </h1>

            <p className="text-lg md:text-xl lg:text-2xl text-white/90 mb-10 leading-relaxed max-w-3xl mx-auto font-light">
              {landingPageContent.hero.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <MarketingButton
                to="/auth/signup"
                variant="primary"
                size="lg"
                className="w-full sm:w-auto min-w-[220px]"
                withArrow
              >
                {landingPageContent.hero.primaryCta}
              </MarketingButton>
              <MarketingButton
                onClick={() => scrollToSection('how-it-works')}
                variant="outline"
                size="lg"
                className="w-full sm:w-auto min-w-[220px]"
              >
                {landingPageContent.hero.secondaryCta}
              </MarketingButton>
            </div>
          </div>
        </div>
      </section>

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
      <MarketingSection variant="white" className="py-12 md:py-16">
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
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-gold/30 flex items-center justify-center mt-1">
                    <div className="w-2 h-2 rounded-full bg-primary-gold"></div>
                  </div>
                  <p className="text-lg text-primary-dark/70">{problem}</p>
                </div>
              ))}
            </div>
            <div className="text-center max-w-2xl mx-auto space-y-4 pt-8 border-t-2 border-primary-gold/40">
              <p className="text-xl text-primary-dark font-bold">
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
      <MarketingSection id="features" variant="gradient-dark" className="relative">
        <div
          className="absolute inset-0 bg-cover bg-no-repeat bg-[center_55%]"
          style={{ backgroundImage: 'url(/kings.construction-029-web.jpeg)' }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-black/25" aria-hidden />
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="text-center mb-12 md:mb-16">
            <div className="inline-block px-4 py-1.5 rounded-full border border-white/30 bg-black/40 backdrop-blur-md text-primary-gold text-sm font-bold tracking-wider mb-4 uppercase">
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
              variant="glass"
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
              variant="glass"
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
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              }
              title="Fast Invoicing"
              description="Turn completed jobs into accurate invoices with one click."
            />
            <FeatureCard
              variant="glass"
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
              variant="glass"
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              }
              title="Client Management"
              description="Keep all contact details, job history, and notes in one place."
            />
            <FeatureCard
              variant="glass"
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
              variant="glass"
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
              </div>
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* Get Started Section */}
      <MarketingSection id="get-started" variant="light" withTopDivider>
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <SectionHeading
              eyebrow="Get Started"
              heading="Ready to simplify your business?"
              subheading="Get started in minutes. Create your account and begin managing quotes, invoices, and schedules in one place."
            />
            <MarketingButton to="/auth/signup" variant="primary" size="lg" withArrow>
              Get Started
            </MarketingButton>
          </div>
        </div>
      </MarketingSection>
    </MarketingLayout>
  )
}

export default LandingPage
