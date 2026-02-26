import { useEffect } from 'react'
import MarketingLayout from '../components/MarketingLayout'
import MarketingSection from '../components/MarketingSection'

const AboutPage = () => {
  useEffect(() => {
    document.title = 'About | JobDock'
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
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">About JobDock</h1>
            <p className="text-lg text-white/70">
              Contractor management software built for service businesses
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
                    JobDock is operated by West Wave Creative (DBA of Amicus Group, Inc.).
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    Authorized Representative
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    Authorized Representative: Dave Witbeck (Amicus Group, Inc.)
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl md:text-3xl font-bold text-primary-dark mb-4 pb-3 border-b-2 border-primary-gold/20">
                    Our Product
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed">
                    JobDock helps service businesses manage quotes, invoices, scheduling, and client information in one simple system. We built it for contractors who want to stop juggling tools and run their jobs in one place.
                  </p>
                </section>
              </div>
            </div>
          </div>
        </div>
      </MarketingSection>
    </MarketingLayout>
  )
}

export default AboutPage
