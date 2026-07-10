import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { settingsApi, TenantSettings } from '@/lib/api/settings'
import { services } from '@/lib/api/services'
import { useAuthStore } from '@/features/auth'
import { CompanyBrandingSection } from './CompanyBrandingSection'
import { EmailTemplatesSection } from './EmailTemplatesSection'
import { PdfTemplatesSection } from './PdfTemplatesSection'
import { BillingSection } from './BillingSection'
import { QuickBooksSection } from './QuickBooksSection'
import { GoogleCalendarSection } from './GoogleCalendarSection'
import { TeamMembersSection } from './TeamMembersSection'
import { HelpSection } from './HelpSection'
import { FeedbackSection } from './FeedbackSection'
import { TesterApprovalSection, isTesterApprovalUiVisible } from './TesterApprovalSection'
import { cn } from '@/lib/utils'
import { Alert, AlertIcon, ChevronLeftIcon, ChevronRightIcon } from './settingsUi'

type TabId =
  | 'billing'
  | 'quickbooks'
  | 'google-calendar'
  | 'team'
  | 'company'
  | 'email'
  | 'pdf'
  | 'help'
  | 'feedback'
  | 'tester'

interface TabConfig {
  id: TabId
  label: string
  component: React.ReactNode
  roles?: ('owner' | 'admin' | 'employee')[]
  emailCheck?: (email: string) => boolean
  /** Hide this tab for single (non-team) accounts */
  hideForSingle?: boolean
}

export const SettingsPage = () => {
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [billingStatus, setBillingStatus] = useState<{ canInviteTeamMembers?: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')
  // Error carried back from the Google Calendar OAuth callback (?tab=google-calendar&error=…).
  const [googleConnectError, setGoogleConnectError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    companyDisplayName: '',
    companySupportEmail: '',
    companyPhone: '',
    timezone: '',
    invoiceEmailSubject: '',
    invoiceEmailBody: '',
    quoteEmailSubject: '',
    quoteEmailBody: '',
  })

  useEffect(() => {
    loadSettings()
  }, [])

  // Handle return from Stripe checkout - switch to billing tab and clear query params
  useEffect(() => {
    const subscribed = searchParams.get('subscribed')
    const upgraded = searchParams.get('upgraded')
    const canceled = searchParams.get('canceled')
    const tab = searchParams.get('tab')
    const connected = searchParams.get('connected')
    if (subscribed === '1' || upgraded === '1' || canceled === '1') {
      setActiveTab('billing')
      setSearchParams({}, { replace: true })
    } else if (tab === 'google-calendar') {
      // OAuth return: land on the tab and capture any error to show inside the section.
      setActiveTab('google-calendar')
      setGoogleConnectError(searchParams.get('error'))
      setSearchParams({}, { replace: true })
    } else if (tab === 'quickbooks' || connected === '1') {
      setActiveTab('quickbooks')
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const [data, billing] = await Promise.all([
        settingsApi.getSettings(),
        services.billing.getStatus().catch(() => ({ canInviteTeamMembers: false })),
      ])
      setBillingStatus(billing)
      setSettings(data)
      setFormData({
        companyDisplayName: data.companyDisplayName || '',
        companySupportEmail: data.companySupportEmail || '',
        companyPhone: data.companyPhone || '',
        timezone: data.timezone || '',
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
  const allTabs: TabConfig[] = useMemo(
    () => [
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
        id: 'team',
        label: 'Team Members',
        component: <TeamMembersSection />,
        roles: ['owner', 'admin'],
        hideForSingle: true,
      },
      {
        id: 'billing',
        label: 'Billing & Subscription',
        component: <BillingSection />,
        roles: ['owner'],
      },
      {
        id: 'quickbooks',
        label: 'QuickBooks',
        component: <QuickBooksSection />,
        roles: ['owner'],
      },
      {
        // No roles restriction: every user manages their own Google Calendar connection.
        id: 'google-calendar',
        label: 'Google Calendar',
        component: <GoogleCalendarSection connectError={googleConnectError} />,
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
      {
        id: 'feedback',
        label: 'Feedback',
        component: <FeedbackSection />,
      },
      {
        id: 'help',
        label: 'Help',
        component: <HelpSection />,
      },
      {
        id: 'tester',
        label: 'Tester approval',
        component: <TesterApprovalSection />,
        emailCheck: isTesterApprovalUiVisible,
      },
    ],
    [
      formData,
      settings,
      googleConnectError,
      handleFieldChange,
      handleSave,
      handleLogoUpload,
      handleInvoicePdfUpload,
      handleQuotePdfUpload,
    ]
  )

  // Filter tabs based on user role, email, and team plan
  const visibleTabs = useMemo(
    () =>
      allTabs.filter(tab => {
        if (tab.roles && user?.role && !tab.roles.includes(user.role)) {
          return false
        }
        if (tab.emailCheck && user?.email && !tab.emailCheck(user.email)) {
          return false
        }
        if (tab.hideForSingle && billingStatus && !billingStatus.canInviteTeamMembers) {
          return false
        }
        return true
      }),
    [allTabs, user?.role, user?.email, billingStatus]
  )

  // Set default tab on mount or when visible tabs change (desktop only)
  useEffect(() => {
    if (!activeTab && visibleTabs.length > 0) {
      // On desktop, auto-select first tab. On mobile, show list view
      // Use media query to check if desktop
      const mediaQuery = window.matchMedia('(min-width: 768px)')
      if (mediaQuery.matches) {
        setActiveTab(visibleTabs[0].id)
      }
    } else if (activeTab && !visibleTabs.find(t => t.id === activeTab)) {
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

  const activeTabConfig = visibleTabs.find(tab => tab.id === activeTab)

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-surface-2" />
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="hidden w-56 shrink-0 space-y-1.5 md:block">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
          <div className="flex-1 space-y-4">
            <div className="h-6 w-48 animate-pulse rounded bg-surface-2" />
            {[0, 1, 2].map(i => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-surface shadow-card" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const navItemCls = (isActive: boolean) =>
    cn(
      'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
      isActive
        ? 'bg-accent-soft text-accent-strong'
        : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
    )

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>
      </div>

      {error && (
        <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />} onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Mobile: Show list or detail view */}
      <div className="md:hidden">
        {mobileView === 'list' ? (
          /* Mobile: Vertical tab list */
          <div className="space-y-1">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabSelect(tab.id)}
                className={cn(navItemCls(false), 'justify-between')}
              >
                <span>{tab.label}</span>
                <ChevronRightIcon className="h-4 w-4 text-ink-subtle" />
              </button>
            ))}
          </div>
        ) : (
          /* Mobile: Detail view with back button */
          activeTabConfig && (
            <div className="space-y-5">
              <button
                type="button"
                onClick={handleBackToList}
                className="-ml-1 flex items-center gap-1.5 rounded-sm text-sm font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ChevronLeftIcon className="h-4 w-4" />
                Back to Settings
              </button>
              <div>{activeTabConfig.component}</div>
            </div>
          )
        )}
      </div>

      {/* Desktop: Side-by-side layout */}
      <div className="hidden min-h-[600px] gap-8 md:flex md:flex-row">
        {/* Desktop: Vertical nav list */}
        <nav className="w-56 flex-shrink-0">
          <div className="space-y-1">
            {visibleTabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={navItemCls(activeTab === tab.id)}>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Desktop: Content Panel - Borderless */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {activeTabConfig ? (
            <div className="pb-6">{activeTabConfig.component}</div>
          ) : (
            <div className="pb-6 text-sm text-ink-muted">Select a setting category to get started</div>
          )}
        </div>
      </div>
    </div>
  )
}
