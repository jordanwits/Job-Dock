import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { publicSiteConfig } from '../content/publicSiteConfig'

const MarketingHeader = () => {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll)
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

  const scrollToSection = (id: string) => {
    setIsMobileMenuOpen(false)
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  return (
    <header 
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        isScrolled 
          ? 'bg-white backdrop-blur-sm shadow-md' 
          : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 z-50">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-sm">
            <img src="/TJD Icon transparent.png" alt="JobDock Logo" className="h-6 w-auto" />
          </div>
          <span className={`text-xl font-bold transition-colors ${
            isScrolled ? 'text-primary-dark' : 'text-white'
          }`}>
            {publicSiteConfig.companyName}
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <button
            onClick={() => scrollToSection('features')}
            className={`relative text-sm font-medium transition-colors pb-1 group ${
              isScrolled 
                ? 'text-primary-dark/70 hover:text-primary-dark' 
                : 'text-white/80 hover:text-white'
            }`}
          >
            Features
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary-gold transition-all duration-300 group-hover:w-full"></span>
          </button>
          <button
            onClick={() => scrollToSection('how-it-works')}
            className={`relative text-sm font-medium transition-colors pb-1 group ${
              isScrolled 
                ? 'text-primary-dark/70 hover:text-primary-dark' 
                : 'text-white/80 hover:text-white'
            }`}
          >
            How It Works
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary-gold transition-all duration-300 group-hover:w-full"></span>
          </button>
          <button
            onClick={() => scrollToSection('benefits')}
            className={`relative text-sm font-medium transition-colors pb-1 group ${
              isScrolled 
                ? 'text-primary-dark/70 hover:text-primary-dark' 
                : 'text-white/80 hover:text-white'
            }`}
          >
            Benefits
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary-gold transition-all duration-300 group-hover:w-full"></span>
          </button>
          <button
            onClick={() => scrollToSection('testimonials')}
            className={`relative text-sm font-medium transition-colors pb-1 group ${
              isScrolled 
                ? 'text-primary-dark/70 hover:text-primary-dark' 
                : 'text-white/80 hover:text-white'
            }`}
          >
            Testimonials
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary-gold transition-all duration-300 group-hover:w-full"></span>
          </button>
          <button
            onClick={() => scrollToSection('why-us')}
            className={`relative text-sm font-medium transition-colors pb-1 group ${
              isScrolled 
                ? 'text-primary-dark/70 hover:text-primary-dark' 
                : 'text-white/80 hover:text-white'
            }`}
          >
            Why Us
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary-gold transition-all duration-300 group-hover:w-full"></span>
          </button>
          <Link to="/auth/login">
            <button className={`text-sm font-medium px-4 py-2 rounded-lg transition-all ${
              isScrolled 
                ? 'text-primary-dark hover:text-primary-blue hover:bg-primary-blue/5' 
                : 'text-white hover:bg-white/10'
            }`}>
              Login
            </button>
          </Link>
          <Link to="/auth/register">
            <button className="text-sm font-semibold text-primary-dark bg-primary-gold hover:bg-primary-gold/90 px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all hover:scale-105">
              Get Early Access
            </button>
          </Link>
        </nav>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`hamburger-button md:hidden p-2 rounded-lg transition-colors ${
            isScrolled ? 'text-primary-dark hover:bg-primary-blue/5' : 'text-white hover:bg-white/10'
          }`}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="mobile-menu md:hidden fixed inset-x-0 top-20 bg-white/98 backdrop-blur-sm shadow-2xl animate-slide-down">
          <nav className="container mx-auto px-4 py-6 flex flex-col gap-4">
            <button
              onClick={() => scrollToSection('features')}
              className="text-left px-4 py-3 text-base font-medium text-primary-dark hover:bg-primary-gold/10 rounded-lg transition-colors"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-left px-4 py-3 text-base font-medium text-primary-dark hover:bg-primary-gold/10 rounded-lg transition-colors"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('benefits')}
              className="text-left px-4 py-3 text-base font-medium text-primary-dark hover:bg-primary-gold/10 rounded-lg transition-colors"
            >
              Benefits
            </button>
            <button
              onClick={() => scrollToSection('testimonials')}
              className="text-left px-4 py-3 text-base font-medium text-primary-dark hover:bg-primary-gold/10 rounded-lg transition-colors"
            >
              Testimonials
            </button>
            <button
              onClick={() => scrollToSection('why-us')}
              className="text-left px-4 py-3 text-base font-medium text-primary-dark hover:bg-primary-gold/10 rounded-lg transition-colors"
            >
              Why Us
            </button>
            <Link to="/auth/login" onClick={() => setIsMobileMenuOpen(false)}>
              <button className="w-full text-left px-4 py-3 text-base font-medium text-primary-dark hover:bg-primary-gold/10 rounded-lg transition-colors">
                Login
              </button>
            </Link>
            <Link to="/auth/register" onClick={() => setIsMobileMenuOpen(false)}>
              <button className="w-full text-center px-6 py-3 text-base font-semibold text-primary-dark bg-primary-gold hover:bg-primary-gold/90 rounded-lg shadow-md transition-all">
                Get Early Access
              </button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}

export default MarketingHeader
