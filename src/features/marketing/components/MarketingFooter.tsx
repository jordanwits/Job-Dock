import { Link } from 'react-router-dom'
import { publicSiteConfig, getFormattedAddress } from '../content/publicSiteConfig'
import MarketingButton from './MarketingButton'

const MarketingFooter = () => {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const hasSocialLinks = Object.values(publicSiteConfig.social).some(link => link)

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
            <p className="text-white/70 text-sm leading-relaxed mb-4">
              Quotes, invoices, scheduling, and client info — organized in one simple system built for service businesses.
            </p>
            {hasSocialLinks && (
              <div className="flex gap-3 mt-4">
                {publicSiteConfig.social.twitter && (
                  <a
                    href={publicSiteConfig.social.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-white/10 hover:bg-primary-gold/20 rounded-full flex items-center justify-center transition-colors"
                    aria-label="Twitter"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                  </a>
                )}
                {publicSiteConfig.social.linkedin && (
                  <a
                    href={publicSiteConfig.social.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-white/10 hover:bg-primary-gold/20 rounded-full flex items-center justify-center transition-colors"
                    aria-label="LinkedIn"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </a>
                )}
                {publicSiteConfig.social.facebook && (
                  <a
                    href={publicSiteConfig.social.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-white/10 hover:bg-primary-gold/20 rounded-full flex items-center justify-center transition-colors"
                    aria-label="Facebook"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </a>
                )}
              </div>
            )}
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
                <button
                  onClick={() => scrollToSection('benefits')}
                  className="text-white/70 hover:text-primary-gold transition-colors"
                >
                  Benefits
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('testimonials')}
                  className="text-white/70 hover:text-primary-gold transition-colors"
                >
                  Testimonials
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('why-us')}
                  className="text-white/70 hover:text-primary-gold transition-colors"
                >
                  Why Us
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
