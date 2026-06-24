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

const iconButton =
  'grid h-10 w-10 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

function ThemeToggle({ theme, onToggle }: { theme: 'dark' | 'light'; onToggle: () => void }) {
  return (
    <button
      onClick={e => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      className={iconButton}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  )
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
    <header className="max-sm:fixed max-sm:left-0 max-sm:right-0 max-sm:top-0 sticky top-0 z-40 w-full border-b border-line bg-surface/80 pt-[env(safe-area-inset-top,0px)] backdrop-blur supports-[backdrop-filter]:bg-surface/70 sm:pt-0">
      {/* Note: sidebar is fixed at lg width (w-64). Offset header content so it doesn't sit underneath it. */}
      <div className="w-full lg:pl-64">
        <div className="container relative mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          {/* Left side: menu button (mobile) and company logo (desktop) */}
          <div className="flex shrink-0 items-center gap-3 md:flex-none">
            {onMenuClick && (
              <button onClick={onMenuClick} className={cn(iconButton, 'lg:hidden')} aria-label="Toggle menu">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            )}
            <Link to={leftLogoHref} className="hidden shrink-0 items-center md:flex">
              {showCompanyLogo ? (
                <img
                  src={companyLogoUrl}
                  alt="Company logo"
                  className="hidden h-10 w-auto max-w-[220px] shrink-0 object-contain md:block"
                  onError={() => setLogoFailed(true)}
                />
              ) : companyDisplayName ? (
                <span className="whitespace-nowrap text-sm font-semibold text-ink md:text-base">
                  {companyDisplayName}
                </span>
              ) : null}
            </Link>
          </div>

          {/* Center: logo on mobile only */}
          <div className="absolute left-1/2 -translate-x-1/2 md:hidden">
            <Link to={leftLogoHref} className="flex shrink-0 items-center">
              {showCompanyLogo ? (
                <img
                  src={companyLogoUrl}
                  alt="Company logo"
                  className="h-10 w-auto max-w-[120px] shrink-0 object-contain sm:max-w-[140px] md:max-w-[220px]"
                  onError={() => setLogoFailed(true)}
                />
              ) : companyDisplayName ? (
                <span className="whitespace-nowrap text-sm font-semibold text-ink">
                  {companyDisplayName}
                </span>
              ) : null}
            </Link>
          </div>

          {/* Right side layout (centered user info + right-aligned actions) */}
          <nav className="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center">
            {user ? (
              <>
                {/* Center: name + email */}
                <div className="hidden min-w-0 items-center justify-center px-4 md:flex">
                  <div className="min-w-0 text-center">
                    <p className="truncate text-sm font-medium text-ink">
                      {user.role === 'employee'
                        ? companyDisplayName
                          ? `${companyDisplayName} Team`
                          : 'Team'
                        : user.name}
                    </p>
                    <p className="truncate text-xs text-ink-subtle">{user.email}</p>
                  </div>
                </div>

                {/* Right: theme toggle + logout (desktop) */}
                <div className="hidden items-center justify-end gap-1.5 md:flex">
                  <ThemeToggle theme={theme} onToggle={toggleTheme} />
                  {onLogout && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onLogout}
                      className="text-ink-muted hover:bg-surface-2 hover:text-ink"
                    >
                      Logout
                    </Button>
                  )}
                </div>

                {/* Mobile: theme toggle + logout */}
                <div className="col-span-2 flex items-center justify-end gap-1.5 md:hidden">
                  <ThemeToggle theme={theme} onToggle={toggleTheme} />
                  {onLogout && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onLogout}
                      className="text-ink-muted hover:bg-surface-2 hover:text-ink"
                    >
                      Logout
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div />
                <div className="flex items-center justify-end gap-2 md:gap-4">
                  <ThemeToggle theme={theme} onToggle={toggleTheme} />
                  <Link to="/auth/login">
                    <Button variant="ghost" size="sm" className="hidden text-ink-muted hover:bg-surface-2 hover:text-ink sm:inline-flex">
                      Login
                    </Button>
                  </Link>
                  <Link to="/auth/signup">
                    <Button variant="primary" size="sm">
                      Sign up
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
