import { ReactNode, useState, useEffect } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import { settingsApi } from '@/lib/api/settings'

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
    <div className="min-h-screen bg-primary-dark">
      <Header
        user={user}
        companyLogoUrl={companyLogoUrl}
        companyDisplayName={companyDisplayName}
        onLogout={onLogout}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
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
          <div
            className={`p-4 md:p-6 space-y-6 min-w-0 ${fullWidth ? 'w-full' : 'container mx-auto'}`}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default AppLayout
