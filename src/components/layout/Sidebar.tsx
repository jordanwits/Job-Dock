import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

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

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full w-64 transform border-r border-line bg-surface transition-transform duration-300 pt-[env(safe-area-inset-top,0px)] sm:pt-0 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-2.5 border-b border-line px-6">
            <img
              src="/icon-192.png"
              alt="CleanDock"
              className="h-7 w-7 flex-shrink-0 object-contain"
            />
            <span className="text-lg font-bold tracking-tight text-ink">CleanDock</span>
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
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent-soft text-accent-strong'
                      : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                  )}
                  onClick={onClose}
                >
                  {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
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
