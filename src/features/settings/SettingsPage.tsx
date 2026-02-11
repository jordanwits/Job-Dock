import { useState, useEffect, useMemo } from 'react'
import { Card, Button } from '@/components/ui'
import { settingsApi, TenantSettings } from '@/lib/api/settings'
import { useAuthStore } from '@/features/auth'
import { CompanyBrandingSection } from './CompanyBrandingSection'
import { EmailTemplatesSection } from './EmailTemplatesSection'
import { PdfTemplatesSection } from './PdfTemplatesSection'
import { EarlyAccessSection } from './EarlyAccessSection'
import { BillingSection } from './BillingSection'
import { TeamMembersSection } from './TeamMembersSection'
import { cn } from '@/lib/utils'

type TabId = 'billing' | 'team' | 'early-access' | 'company' | 'email' | 'pdf'

interface TabConfig {
  id: TabId
  label: string
  component: React.ReactNode
  roles?: ('owner' | 'admin' | 'employee')[]
  emailCheck?: (email: string) => boolean
}

export const SettingsPage = () => {
  const { user } = useAuthStore()
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')

  // Form state
  const [formData, setFormData] = useState({
    companyDisplayName: '',
    companySupportEmail: '',
    companyPhone: '',
    invoiceEmailSubject: '',
    invoiceEmailBody: '',
    quoteEmailSubject: '',
    quoteEmailBody: '',
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const data = await settingsApi.getSettings()
      setSettings(data)
      setFormData({
        companyDisplayName: data.companyDisplayName || '',
        companySupportEmail: data.companySupportEmail || '',
        companyPhone: data.companyPhone || '',
        invoiceEmailSubject: data.invoiceEmailSubject || '',
        invoiceEmailBody: data.invoiceEmailBody || '',
        quoteEmailSubject: data.quoteEmailSubject || '',
        quoteEmailBody: data.quoteEmailBody || '',
      })
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setHasUnsavedChanges(true)
  }

  const handleSave = async () => {
    try {
      const updated = await settingsApi.updateSettings(formData)
      setSettings(updated)
      setHasUnsavedChanges(false)
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save settings')
      throw err // Re-throw so section can handle it
    }
  }

  const handleLogoUpload = async (file: File) => {
    try {
      const updated = await settingsApi.uploadLogo(file)
      setSettings(updated)
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload logo')
    }
  }

  const handleInvoicePdfUpload = async (file: File) => {
    try {
      const updated = await settingsApi.uploadInvoicePdf(file)
      setSettings(updated)
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload invoice PDF template')
    }
  }

  const handleQuotePdfUpload = async (file: File) => {
    try {
      const updated = await settingsApi.uploadQuotePdf(file)
      setSettings(updated)
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload quote PDF template')
    }
  }

  // Define all tabs with their configurations (after handlers are defined)
  const allTabs: TabConfig[] = useMemo(() => [
    {
      id: 'billing',
      label: 'Billing & Subscription',
      component: <BillingSection />,
      roles: ['owner'],
    },
    {
      id: 'team',
      label: 'Team Members',
      component: <TeamMembersSection />,
      roles: ['owner', 'admin'],
    },
    {
      id: 'early-access',
      label: 'Early Access',
      component: <EarlyAccessSection />,
      emailCheck: (email) => email === 'jordan@westwavecreative.com',
    },
    {
      id: 'company',
      label: 'Company & Branding',
      component: (
        <CompanyBrandingSection
          formData={formData}
          settings={settings}
          onFieldChange={handleFieldChange}
          onLogoUpload={handleLogoUpload}
          onSave={handleSave}
        />
      ),
    },
    {
      id: 'email',
      label: 'Email Templates',
      component: (
        <EmailTemplatesSection
          formData={formData}
          onFieldChange={handleFieldChange}
          onSave={handleSave}
        />
      ),
    },
    {
      id: 'pdf',
      label: 'PDF Templates',
      component: (
        <PdfTemplatesSection
          settings={settings}
          onInvoicePdfUpload={handleInvoicePdfUpload}
          onQuotePdfUpload={handleQuotePdfUpload}
        />
      ),
    },
  ], [formData, settings, handleFieldChange, handleSave, handleLogoUpload, handleInvoicePdfUpload, handleQuotePdfUpload])

  // Filter tabs based on user role and email
  const visibleTabs = useMemo(() => allTabs.filter((tab) => {
    if (tab.roles && user?.role && !tab.roles.includes(user.role)) {
      return false
    }
    if (tab.emailCheck && user?.email && !tab.emailCheck(user.email)) {
      return false
    }
    return true
  }), [allTabs, user?.role, user?.email])

  // Set default tab on mount or when visible tabs change (desktop only)
  useEffect(() => {
    if (!activeTab && visibleTabs.length > 0) {
      // On desktop, auto-select first tab. On mobile, show list view
      // Use media query to check if desktop
      const mediaQuery = window.matchMedia('(min-width: 768px)')
      if (mediaQuery.matches) {
        setActiveTab(visibleTabs[0].id)
      }
    } else if (activeTab && !visibleTabs.find((t) => t.id === activeTab)) {
      // If current tab is no longer visible, switch to first visible tab
      const mediaQuery = window.matchMedia('(min-width: 768px)')
      if (mediaQuery.matches) {
        setActiveTab(visibleTabs[0]?.id || null)
      } else {
        setActiveTab(null)
        setMobileView('list')
      }
    }
  }, [visibleTabs, activeTab])

  const handleTabSelect = (tabId: TabId) => {
    setActiveTab(tabId)
    const isMobile = window.innerWidth < 768
    if (isMobile) {
      setMobileView('detail')
    }
  }

  const handleBackToList = () => {
    setMobileView('list')
    setActiveTab(null)
  }

  // Handle window resize - reset mobile view if switching to desktop
  useEffect(() => {
    const handleResize = () => {
      const mediaQuery = window.matchMedia('(min-width: 768px)')
      if (mediaQuery.matches && mobileView === 'detail') {
        // Switched to desktop, reset mobile view
        setMobileView('list')
        if (!activeTab && visibleTabs.length > 0) {
          setActiveTab(visibleTabs[0].id)
        }
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [mobileView, activeTab, visibleTabs])

  const activeTabConfig = visibleTabs.find((tab) => tab.id === activeTab)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-white/5 bg-primary-dark-secondary/50 p-6 shadow-sm shadow-black/20">
          <div className="h-6 w-48 bg-primary-dark rounded animate-pulse mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-primary-dark rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-primary-light tracking-tight">
          <span className="text-primary-gold">Settings</span>
        </h1>
      </div>

      {error && (
        <Card className="bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20">
          <p className="text-red-400">{error}</p>
        </Card>
      )}

      {/* Mobile: Show list or detail view */}
      <div className="md:hidden">
        {mobileView === 'list' ? (
          /* Mobile: Vertical tab list */
          <div className="space-y-1">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabSelect(tab.id)}
                className={cn(
                  'w-full flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left',
                  'text-primary-light/70 hover:bg-primary-dark hover:text-primary-light',
                  'active:bg-primary-dark'
                )}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        ) : (
          /* Mobile: Detail view with back button */
          activeTabConfig && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                onClick={handleBackToList}
                className="flex items-center gap-2 -ml-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to Settings
              </Button>
              <div>{activeTabConfig.component}</div>
            </div>
          )
        )}
      </div>

      {/* Desktop: Side-by-side layout */}
      <div className="hidden md:flex md:flex-row gap-6 min-h-[600px]">
        {/* Desktop: Vertical nav list */}
        <nav className="w-56 flex-shrink-0">
          <div className="space-y-1">
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left',
                    isActive
                      ? 'bg-primary-blue text-primary-light'
                      : 'text-primary-light/70 hover:bg-primary-dark hover:text-primary-light'
                  )}
                >
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* Desktop: Content Panel - Borderless */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {activeTabConfig ? (
            <div className="pb-6">
              {activeTabConfig.component}
            </div>
          ) : (
            <div className="pb-6 text-primary-light/70">
              Select a setting category to get started
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
