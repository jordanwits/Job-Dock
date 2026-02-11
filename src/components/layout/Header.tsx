import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'

export interface HeaderProps {
  user?: {
    name: string
    email: string
    role?: 'owner' | 'admin' | 'employee'
  }
  companyLogoUrl?: string
  companyDisplayName?: string
  onLogout?: () => void
  onMenuClick?: () => void
}

const Header = ({ user, companyLogoUrl, companyDisplayName, onLogout, onMenuClick }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-primary-blue bg-primary-dark-secondary/95 backdrop-blur supports-[backdrop-filter]:bg-primary-dark-secondary/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo and Menu Button */}
        <div className="flex items-center gap-3">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-lg hover:bg-primary-blue/20 text-primary-light transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          )}
          <Link to={user ? '/app' : '/'} className="flex items-center space-x-2">
            <span className="text-xl md:text-2xl font-bold text-primary-gold">JobDock</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-2 md:gap-6">
          {user ? (
            <>
              <div className="hidden md:flex items-center space-x-3">
                {companyLogoUrl && (
                  <img
                    src={companyLogoUrl}
                    alt="Company logo"
                    className="h-8 w-auto max-w-[120px] object-contain"
                  />
                )}
                <div className="text-center">
                  <p className="text-sm font-medium text-primary-light">
                    {user.role === 'employee' ? (companyDisplayName ? `${companyDisplayName} Team` : 'Team') : user.name}
                  </p>
                  <p className="text-xs text-primary-light/70">{user.email}</p>
                </div>
                {onLogout && (
                  <Button variant="ghost" size="sm" onClick={onLogout}>
                    Logout
                  </Button>
                )}
              </div>
              {/* Mobile user menu */}
              <div className="md:hidden flex items-center gap-2">
                {companyLogoUrl && (
                  <img
                    src={companyLogoUrl}
                    alt="Company logo"
                    className="h-6 w-auto max-w-[80px] object-contain"
                  />
                )}
                <span className="text-sm font-medium text-primary-light truncate max-w-[100px]">
                  {user.role === 'employee' ? (companyDisplayName ? `${companyDisplayName} Team` : 'Team') : user.name}
                </span>
                {onLogout && (
                  <Button variant="ghost" size="sm" onClick={onLogout}>
                    Logout
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/auth/login">
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                  Login
                </Button>
              </Link>
              <Link to="/request-access">
                <Button variant="primary" size="sm">
                  Request Access
                </Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Header
