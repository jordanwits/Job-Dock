import { Link } from 'react-router-dom'
import { publicSiteConfig, getFormattedAddress } from '../content/publicSiteConfig'

const MarketingFooter = () => {
  return (
    <footer className="border-t border-primary-blue bg-primary-dark-secondary">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <div className="bg-white rounded-lg px-3 py-2 inline-block mb-4">
              <img 
                src="/TJD Horizontal.png" 
                alt="JobDock Logo" 
                className="h-8 md:h-10 w-auto"
              />
            </div>
            <p className="text-primary-light/70 text-sm mb-4">
              Complete contractor management platform for service providers.
            </p>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="text-lg font-semibold text-primary-light mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/privacy"
                  className="text-primary-light/70 hover:text-primary-gold transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="text-primary-light/70 hover:text-primary-gold transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  to="/email-policy"
                  className="text-primary-light/70 hover:text-primary-gold transition-colors"
                >
                  Email Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold text-primary-light mb-4">Contact</h4>
            <div className="space-y-2 text-sm text-primary-light/70">
              <p>
                <strong className="text-primary-light">Support:</strong>{' '}
                <a
                  href={`mailto:${publicSiteConfig.supportEmail}`}
                  className="text-primary-gold hover:text-primary-light transition-colors underline"
                >
                  {publicSiteConfig.supportEmail}
                </a>
              </p>
              {publicSiteConfig.phoneNumber && (
                <p>
                  <strong className="text-primary-light">Phone:</strong>{' '}
                  <a
                    href={`tel:${publicSiteConfig.phoneNumber}`}
                    className="text-primary-gold hover:text-primary-light transition-colors underline"
                  >
                    {publicSiteConfig.phoneNumber}
                  </a>
                </p>
              )}
              <p className="pt-2">
                <strong className="text-primary-light">Business Address:</strong>
              </p>
              <p className="leading-relaxed">{getFormattedAddress()}</p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-primary-blue pt-8 text-center text-sm text-primary-light/60">
          <p>
            &copy; {publicSiteConfig.copyrightYear} {publicSiteConfig.copyrightHolder}. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default MarketingFooter
