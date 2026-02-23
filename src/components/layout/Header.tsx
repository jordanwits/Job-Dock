import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

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
  const { theme, toggleTheme } = useTheme()

  const leftLogoHref = useMemo(() => (user ? '/app' : '/'), [user])
  const showCompanyLogo = Boolean(companyLogoUrl) && !logoFailed

  return (
    <header className={cn(
      "sticky top-0 z-40 w-full border-b backdrop-blur",
      theme === 'dark'
        ? 'border-primary-blue bg-primary-dark-secondary/95 supports-[backdrop-filter]:bg-primary-dark-secondary/60'
        : 'border-gray-200 bg-white/95 supports-[backdrop-filter]:bg-white/60'
    )}>
      {/* Note: sidebar is fixed at lg width (w-64). Offset header content so it doesn't sit underneath it. */}
      <div className="w-full lg:pl-64">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6 relative">
          {/* Left side: menu button (mobile) and company logo (desktop) */}
          <div className="flex items-center gap-3 shrink-0 md:flex-none">
            {onMenuClick && (
              <button
                onClick={onMenuClick}
                className={cn(
                  "lg:hidden p-2 rounded-lg transition-colors",
                  theme === 'dark'
                    ? 'hover:bg-primary-blue/20 text-primary-light'
                    : 'hover:bg-gray-100 text-primary-lightText'
                )}
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
                <span className={cn(
                  "text-sm md:text-base font-semibold whitespace-nowrap",
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>
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
                <span className={cn(
                  "text-sm font-semibold whitespace-nowrap",
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>
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
                    <p className={cn(
                      "text-sm font-medium truncate",
                      theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                    )}>
                      {user.role === 'employee'
                        ? companyDisplayName
                          ? `${companyDisplayName} Team`
                          : 'Team'
                        : user.name}
                    </p>
                    <p className={cn(
                      "text-xs truncate",
                      theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                    )}>{user.email}</p>
                  </div>
                </div>

                {/* Right: theme toggle + logout (desktop) */}
                <div className="hidden md:flex items-center justify-end gap-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleTheme()
                    }}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      theme === 'dark'
                        ? 'hover:bg-primary-blue/20 text-primary-light'
                        : 'hover:bg-gray-100 text-primary-lightText'
                    )}
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {theme === 'dark' ? (
                      // Sun icon for light mode
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                    ) : (
                      // Moon icon for dark mode
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                        />
                      </svg>
                    )}
                  </button>
                  {onLogout && (
                    <Button variant="ghost" size="sm" onClick={onLogout}>
                      Logout
                    </Button>
                  )}
                </div>

                {/* Mobile: theme toggle + logout */}
                <div className="md:hidden col-span-2 flex items-center justify-end gap-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleTheme()
                    }}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      theme === 'dark'
                        ? 'hover:bg-primary-blue/20 text-primary-light'
                        : 'hover:bg-gray-100 text-primary-lightText'
                    )}
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {theme === 'dark' ? (
                      // Sun icon for light mode
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                    ) : (
                      // Moon icon for dark mode
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                        />
                      </svg>
                    )}
                  </button>
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
                <div className="flex items-center justify-end gap-2 md:gap-6">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleTheme()
                    }}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      theme === 'dark'
                        ? 'hover:bg-primary-blue/20 text-primary-light'
                        : 'hover:bg-gray-100 text-primary-lightText'
                    )}
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {theme === 'dark' ? (
                      // Sun icon for light mode
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                    ) : (
                      // Moon icon for dark mode
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                        />
                      </svg>
                    )}
                  </button>
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
