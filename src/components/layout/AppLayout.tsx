import { ReactNode, useState, useEffect } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import { settingsApi } from '@/lib/api/settings'
import { AssistantWidget } from '@/features/assistant/AssistantWidget'
import { DataRefreshListener } from '@/features/assistant/DataRefreshListener'

export interface AppLayoutProps {
  children: ReactNode
  sidebarItems?: Array<{ label: string; href: string; icon?: React.ReactNode }>
  user?: {
    name: string
    email: string
    role?: 'owner' | 'admin' | 'employee'
  }
  onLogout?: () => void
  fullWidth?: boolean
}

const AppLayout = ({ children, sidebarItems = [], user, onLogout, fullWidth }: AppLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | undefined>()
  const [companyDisplayName, setCompanyDisplayName] = useState<string | undefined>()
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await settingsApi.getSettings()
        if (settings.logoSignedUrl) {
          setCompanyLogoUrl(settings.logoSignedUrl)
        }
        // Use company display name, fallback to tenant name (e.g. "West Wave Creative")
        const displayName = settings.companyDisplayName?.trim() || settings.tenantName?.trim()
        if (displayName) {
          setCompanyDisplayName(displayName)
        }
      } catch (error) {
        // Silently fail - logo/name are optional
        console.error('Failed to fetch company settings:', error)
      }
    }

    if (user) {
      fetchSettings()
    }
  }, [user])

  return (
    <div className="min-h-screen bg-canvas">
      <Header
        user={user}
        companyLogoUrl={companyLogoUrl}
        companyDisplayName={companyDisplayName}
        onLogout={onLogout}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />
      {/* Spacer for fixed header on mobile - prevents content from sliding under nav */}
      <div
        className="h-[calc(env(safe-area-inset-top,0px)+4rem)] max-sm:block sm:hidden flex-shrink-0"
        aria-hidden="true"
      />
      <div className="flex">
        {sidebarItems.length > 0 && (
          <Sidebar
            items={sidebarItems}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        )}
        <main className="flex-1 lg:ml-64 min-w-0">
          {/*
            Extra bottom padding reserves room for the fixed Assistant launcher (bottom-right,
            ~48px tall plus its own 1.25rem offset). Without it the launcher sits on top of
            whatever ends the page — on Settings it completely covered the "Save changes"
            button, which could not be scrolled clear and so was impossible to click.
          */}
          <div
            className={`p-4 md:p-6 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] space-y-6 min-w-0 ${fullWidth ? 'w-full' : 'container mx-auto'}`}
          >
            {children}
          </div>
        </main>
      </div>
      <AssistantWidget enabled={!!user} />
      {user && <DataRefreshListener />}
    </div>
  )
}

export default AppLayout
