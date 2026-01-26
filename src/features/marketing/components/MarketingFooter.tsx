import { Link } from 'react-router-dom'
import { publicSiteConfig, getFormattedAddress } from '../content/publicSiteConfig'

const MarketingFooter = () => {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <footer className="relative bg-gradient-to-br from-primary-dark via-primary-dark-secondary to-primary-blue text-white overflow-hidden">
      {/* Large watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
        <div className="text-[20rem] font-bold tracking-tighter select-none">
          {publicSiteConfig.companyName}
        </div>
      </div>

      <div className="relative container mx-auto px-4 md:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Company Info */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex items-center justify-center w-10 h-10 bg-white rounded-full">
                <img src="/TJD Icon transparent.png" alt="JobDock Logo" className="h-6 w-auto" />
              </div>
              <span className="text-xl font-bold">{publicSiteConfig.companyName}</span>
            </div>
            <p className="text-white/70 text-sm leading-relaxed">
              Professional contractor management platform for service businesses. Streamline quotes, invoices, scheduling, and client relationships in one powerful tool.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-base font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button
                  onClick={() => scrollToSection('features')}
                  className="text-white/70 hover:text-primary-gold transition-colors"
                >
                  Features
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="text-white/70 hover:text-primary-gold transition-colors"
                >
                  How It Works
                </button>
              </li>
              <li>
                <Link
                  to="/privacy"
                  className="text-white/70 hover:text-primary-gold transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="text-white/70 hover:text-primary-gold transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  to="/email-policy"
                  className="text-white/70 hover:text-primary-gold transition-colors"
                >
                  Email Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-base font-semibold mb-4">Contact Us</h4>
            <div className="space-y-3 text-sm">
              <p className="text-white/70">
                <span className="font-medium text-white">Email:</span>{' '}
                <a
                  href={`mailto:${publicSiteConfig.supportEmail}`}
                  className="text-primary-gold hover:text-primary-light transition-colors"
                >
                  {publicSiteConfig.supportEmail}
                </a>
              </p>
              {publicSiteConfig.phoneNumber && (
                <p className="text-white/70">
                  <span className="font-medium text-white">Phone:</span>{' '}
                  <a
                    href={`tel:${publicSiteConfig.phoneNumber}`}
                    className="text-primary-gold hover:text-primary-light transition-colors"
                  >
                    {publicSiteConfig.phoneNumber}
                  </a>
                </p>
              )}
              <div className="pt-2">
                <p className="font-medium text-white mb-1">Business Address</p>
                <p className="text-white/70 leading-relaxed">{getFormattedAddress()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 pt-8 text-center">
          <p className="text-sm text-white/60">
            &copy; {publicSiteConfig.copyrightYear} {publicSiteConfig.copyrightHolder}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default MarketingFooter
