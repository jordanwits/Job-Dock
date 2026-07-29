import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { publicSiteConfig } from '../content/publicSiteConfig'

const NAV_LINKS = [
  { label: 'Features', target: 'features' },
  { label: 'Reviews', target: 'reviews' },
  { label: 'Pricing', target: 'pricing' },
]

const MarketingHeader = () => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Read from localStorage in an effect rather than from useAuthStore, for two reasons. This header
  // is in the prerender graph — MarketingLayout renders it — and importing the store pulls the auth
  // and mock-API layers into the Node render, where they touch localStorage at module scope and
  // throw (see the header comment in scripts/prerender/entry.tsx). Importing it through
  // '@/features/auth' would also close a cycle, since that barrel re-exports SignupPage, which
  // renders MarketingLayout. Resolving after mount additionally leaves the prerendered HTML in its
  // signed-out state, which is what crawlers and first-time visitors should receive.
  // `auth_token` is written on login and removed on logout by the store, so it tracks the session.
  useEffect(() => {
    setIsAuthenticated(!!window.localStorage.getItem('auth_token'))
  }, [pathname])

  // Offering "Start free" to someone who already has an account sends them to a signup page that
  // immediately bounces them to /app. Point them at the app instead, and drop "Log in".
  const ctaLabel = isAuthenticated ? 'Go to app' : 'Start free'
  const ctaHref = isAuthenticated ? '/app' : '/auth/signup'

  // The header is transparent only while resting at the top of the bright landing hero.
  const isLanding = pathname === '/'
  const isFilled = !isLanding || isScrolled

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (isMobileMenuOpen && !target.closest('.mobile-menu') && !target.closest('.hamburger-button')) {
        setIsMobileMenuOpen(false)
      }
    }
    if (isMobileMenuOpen) {
      document.addEventListener('click', handleClickOutside)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  const handleSectionClick = (id: string) => {
    setIsMobileMenuOpen(false)
    if (pathname === '/') {
      const element = document.getElementById(id)
      if (element) {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        element.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      }
    } else {
      navigate(`/#${id}`)
    }
  }

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-300 pt-[env(safe-area-inset-top,0px)] sm:pt-0 ${
        isFilled ? 'bg-white/85 shadow-sm backdrop-blur-xl' : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link to="/" className="z-50 flex min-w-0 max-w-[160px] items-center gap-2 sm:max-w-[220px]">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-100">
            <img src="/icon-192.png" alt="CleanDock logo" className="h-6 w-auto" />
          </div>
          <span className={`truncate text-xl font-extrabold tracking-tight ${isFilled ? 'text-slate-900' : 'text-white'}`}>
            {publicSiteConfig.companyName}
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <button
              key={link.target}
              onClick={() => handleSectionClick(link.target)}
              className={`group relative pb-1 text-sm font-semibold transition-colors ${isFilled ? 'text-slate-600 hover:text-slate-900' : 'text-white/80 hover:text-white'}`}
            >
              {link.label}
              <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-teal-500 transition-all duration-300 group-hover:w-full" />
            </button>
          ))}
          {!isAuthenticated && (
            <Link
              to="/auth/login"
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${isFilled ? 'text-slate-700 hover:bg-slate-100' : 'text-white/90 hover:bg-white/10'}`}
            >
              Log in
            </Link>
          )}
          <Link
            to={ctaHref}
            className="rounded-full bg-teal-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-500/25 transition-all hover:-translate-y-0.5 hover:bg-teal-600"
          >
            {ctaLabel}
          </Link>
        </nav>

        {/* Mobile Navigation */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            to={ctaHref}
            className="rounded-full bg-teal-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-teal-500/25"
          >
            {ctaLabel}
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`hamburger-button rounded-lg p-2 transition-colors ${isFilled ? 'text-slate-700 hover:bg-slate-100' : 'text-white hover:bg-white/10'}`}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="mobile-menu animate-slide-down fixed inset-x-0 top-20 border-t border-slate-200 bg-white shadow-2xl md:hidden">
          <nav className="container mx-auto flex flex-col gap-2 px-4 py-6">
            {NAV_LINKS.map((link) => (
              <button
                key={link.target}
                onClick={() => handleSectionClick(link.target)}
                className="rounded-lg px-4 py-3 text-left text-base font-semibold text-slate-800 transition-colors hover:bg-teal-50"
              >
                {link.label}
              </button>
            ))}
            {!isAuthenticated && (
              <Link
                to="/auth/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-lg px-4 py-3 text-left text-base font-semibold text-slate-800 transition-colors hover:bg-teal-50"
              >
                Log in
              </Link>
            )}
            <Link
              to={ctaHref}
              onClick={() => setIsMobileMenuOpen(false)}
              className="mt-1 rounded-full bg-teal-500 px-6 py-3 text-center text-base font-bold text-white shadow-md"
            >
              {ctaLabel}
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}

export default MarketingHeader
