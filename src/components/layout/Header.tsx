import { useMemo, useState } from 'react'
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

const Header = ({
  user,
  companyLogoUrl,
  companyDisplayName,
  onLogout,
  onMenuClick,
}: HeaderProps) => {
  const [logoFailed, setLogoFailed] = useState(false)

  const leftLogoHref = useMemo(() => (user ? '/app' : '/'), [user])
  const showCompanyLogo = Boolean(companyLogoUrl) && !logoFailed

  return (
    <header className="sticky top-0 z-40 w-full border-b border-primary-blue bg-primary-dark-secondary/95 backdrop-blur supports-[backdrop-filter]:bg-primary-dark-secondary/60">
      {/* Note: sidebar is fixed at lg width (w-64). Offset header content so it doesn't sit underneath it. */}
      <div className="w-full lg:pl-64">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6 relative">
          {/* Left side: menu button (mobile) and company logo (desktop) */}
          <div className="flex items-center gap-3 shrink-0 md:flex-none">
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
            <Link to={leftLogoHref} className="hidden md:flex items-center shrink-0">
              {showCompanyLogo ? (
                <img
                  src={companyLogoUrl}
                  alt="Company logo"
                  className="h-10 w-auto max-w-[220px] object-contain shrink-0"
                  onError={() => setLogoFailed(true)}
                />
              ) : companyDisplayName ? (
                <span className="text-sm md:text-base font-semibold text-primary-light whitespace-nowrap">
                  {companyDisplayName}
                </span>
              ) : null}
            </Link>
          </div>

          {/* Center: logo on mobile only */}
          <div className="md:hidden absolute left-1/2 -translate-x-1/2">
            <Link to={leftLogoHref} className="flex items-center shrink-0">
              {showCompanyLogo ? (
                <img
                  src={companyLogoUrl}
                  alt="Company logo"
                  className="h-10 w-auto max-w-[180px] object-contain shrink-0"
                  onError={() => setLogoFailed(true)}
                />
              ) : companyDisplayName ? (
                <span className="text-sm font-semibold text-primary-light whitespace-nowrap">
                  {companyDisplayName}
                </span>
              ) : null}
            </Link>
          </div>

          {/* Right side layout (centered user info + right-aligned actions) */}
          <nav className="grid flex-1 grid-cols-[1fr_auto] items-center min-w-0">
            {user ? (
              <>
                {/* Center: name + email */}
                <div className="hidden md:flex items-center justify-center min-w-0 px-4">
                  <div className="text-center min-w-0">
                    <p className="text-sm font-medium text-primary-light truncate">
                      {user.role === 'employee'
                        ? companyDisplayName
                          ? `${companyDisplayName} Team`
                          : 'Team'
                        : user.name}
                    </p>
                    <p className="text-xs text-primary-light/70 truncate">{user.email}</p>
                  </div>
                </div>

                {/* Right: logout (desktop) */}
                <div className="hidden md:flex items-center justify-end">
                  {onLogout && (
                    <Button variant="ghost" size="sm" onClick={onLogout}>
                      Logout
                    </Button>
                  )}
                </div>

                {/* Mobile: logout only */}
                <div className="md:hidden col-span-2 flex items-center justify-end">
                  {onLogout && (
                    <Button variant="ghost" size="sm" onClick={onLogout}>
                      Logout
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div />
                <div className="flex items-center justify-end gap-6 md:gap-12">
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
                </div>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}

export default Header
