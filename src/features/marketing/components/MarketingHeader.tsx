import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { publicSiteConfig } from '../content/publicSiteConfig'

const MarketingHeader = () => {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <header 
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        isScrolled 
          ? 'bg-primary-light/95 backdrop-blur shadow-sm' 
          : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-sm">
            <img src="/TJD Icon transparent.png" alt="JobDock Logo" className="h-6 w-auto" />
          </div>
          <span className={`text-xl font-bold transition-colors ${
            isScrolled ? 'text-primary-dark' : 'text-white'
          }`}>
            {publicSiteConfig.companyName}
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-6">
          <button
            onClick={() => scrollToSection('features')}
            className={`hidden md:inline-flex relative text-sm font-medium transition-colors pb-1 group ${
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
            className={`hidden md:inline-flex relative text-sm font-medium transition-colors pb-1 group ${
              isScrolled 
                ? 'text-primary-dark/70 hover:text-primary-dark' 
                : 'text-white/80 hover:text-white'
            }`}
          >
            How It Works
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
            <button className="text-sm font-semibold text-primary-dark bg-primary-gold hover:bg-primary-gold/90 px-5 py-2 rounded-lg shadow-sm transition-all hover:shadow-md">
              Get Started Free
            </button>
          </Link>
        </nav>
      </div>
    </header>
  )
}

export default MarketingHeader
