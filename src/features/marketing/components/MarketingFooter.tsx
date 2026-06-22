import { Link, useLocation, useNavigate } from 'react-router-dom'
import { publicSiteConfig } from '../content/publicSiteConfig'

const SECTION_LINKS = [
  { label: 'Features', target: 'features' },
  { label: 'Pricing', target: 'pricing' },
]

const MarketingFooter = () => {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const handleSection = (id: string) => {
    if (pathname === '/') {
      const el = document.getElementById(id)
      if (el) {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      }
    } else {
      navigate(`/#${id}`)
    }
  }

  const hasSocialLinks = Object.values(publicSiteConfig.social).some((link) => link)

  return (
    <footer className="relative border-t border-slate-200 bg-slate-50 text-slate-600">
      <div className="container mx-auto px-4 py-12 md:px-6 md:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-12">
          {/* Company Info */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-100">
                <img src="/TJD Icon transparent.png" alt="JobDock logo" className="h-6 w-auto" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900">
                {publicSiteConfig.companyName}
              </span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-slate-500">
              Quotes, invoices, scheduling, online booking, and before/after proof in one simple app,
              built for cleaning businesses.
            </p>
            {hasSocialLinks && (
              <div className="mt-5 flex gap-3">
                {publicSiteConfig.social.twitter && (
                  <a
                    href={publicSiteConfig.social.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-100 transition-colors hover:text-teal-600"
                    aria-label="Twitter"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                    </svg>
                  </a>
                )}
                {publicSiteConfig.social.linkedin && (
                  <a
                    href={publicSiteConfig.social.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-100 transition-colors hover:text-teal-600"
                    aria-label="LinkedIn"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </a>
                )}
                {publicSiteConfig.social.facebook && (
                  <a
                    href={publicSiteConfig.social.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-100 transition-colors hover:text-teal-600"
                    aria-label="Facebook"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="mb-4 text-sm font-bold text-slate-900">Quick Links</h4>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm md:flex md:flex-col">
              {SECTION_LINKS.map((link) => (
                <li key={link.target}>
                  <button
                    onClick={() => handleSection(link.target)}
                    className="text-left text-slate-500 transition-colors hover:text-teal-600"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
              <li>
                <Link to="/about" className="text-slate-500 transition-colors hover:text-teal-600">
                  About
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-slate-500 transition-colors hover:text-teal-600">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-slate-500 transition-colors hover:text-teal-600">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/sms-consent" className="text-slate-500 transition-colors hover:text-teal-600">
                  SMS Consent
                </Link>
              </li>
              <li>
                <Link to="/email-policy" className="text-slate-500 transition-colors hover:text-teal-600">
                  Email Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="mb-4 text-sm font-bold text-slate-900">Contact Us</h4>
            <p className="text-sm text-slate-500">
              <span className="font-semibold text-slate-700">Email:</span>{' '}
              <a
                href={`mailto:${publicSiteConfig.supportEmail}`}
                className="text-teal-600 transition-colors hover:text-teal-700"
              >
                {publicSiteConfig.supportEmail}
              </a>
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 space-y-1.5 border-t border-slate-200 pt-6 text-center md:mt-12 md:pt-8">
          <p className="text-sm text-slate-500">
            JobDock is a product of West Wave Creative, a DBA of Amicus Group, Inc. &copy;{' '}
            {new Date().getFullYear()} Amicus Group, Inc. All rights reserved.
          </p>
          <p className="text-sm text-slate-500">
            &copy; {publicSiteConfig.copyrightYear} {publicSiteConfig.copyrightHolder}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default MarketingFooter
