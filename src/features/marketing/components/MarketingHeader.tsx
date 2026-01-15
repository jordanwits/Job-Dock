import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { publicSiteConfig } from '../content/publicSiteConfig'

const MarketingHeader = () => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-primary-blue bg-primary-dark-secondary/95 backdrop-blur supports-[backdrop-filter]:bg-primary-dark-secondary/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-white rounded-full">
            <img src="/TJD Icon transparent.png" alt="JobDock Logo" className="h-6 md:h-8 w-auto" />
          </div>
          <span className="text-xl md:text-2xl font-bold text-primary-gold">
            {publicSiteConfig.companyName}
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-2 md:gap-6">
          <Link
            to="/email-policy"
            className="hidden sm:inline-flex text-sm text-primary-light/70 hover:text-primary-gold transition-colors"
          >
            Email Policy
          </Link>
          <Link to="/auth/login">
            <Button variant="ghost" size="sm">
              Login
            </Button>
          </Link>
          <Link to="/auth/register">
            <Button variant="primary" size="sm">
              Sign Up
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  )
}

export default MarketingHeader
