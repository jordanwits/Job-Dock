import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

export interface NavItem {
  label: string
  href: string
  icon?: React.ReactNode
}

export interface SidebarProps {
  items: NavItem[]
  isOpen?: boolean
  onClose?: () => void
}

const Sidebar = ({ items, isOpen = true, onClose }: SidebarProps) => {
  const location = useLocation()
  const { theme } = useTheme()

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full w-64 transform border-r transition-transform duration-300 lg:translate-x-0',
          theme === 'dark'
            ? 'border-primary-blue bg-primary-dark-secondary'
            : 'border-gray-200 bg-white',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className={cn(
            "flex h-16 items-center border-b px-6",
            theme === 'dark' ? 'border-primary-blue' : 'border-gray-200/20'
          )}>
            <span className="text-xl font-bold text-primary-gold">JobDock</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {items.map(item => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? theme === 'dark'
                        ? 'bg-primary-blue text-primary-light'
                        : 'bg-primary-blue text-white'
                      : theme === 'dark'
                        ? 'text-primary-light/70 hover:bg-primary-dark hover:text-primary-light'
                        : 'text-primary-lightTextSecondary hover:bg-gray-100 hover:text-primary-lightText'
                  )}
                  onClick={onClose}
                >
                  {item.icon && <span>{item.icon}</span>}
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
