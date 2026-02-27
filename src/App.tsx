import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AppLayout, ProtectedRoute, AdminRoute } from '@/components'
import { BillingGuard } from '@/components/billing'
import SessionMonitor from '@/components/SessionMonitor'
import { LoginPage, RegisterPage, ResetPasswordPage, useAuthStore } from '@/features/auth'
import { DashboardPage } from '@/features/dashboard'
import { CRMPage } from '@/features/crm'
import { QuotesPage } from '@/features/quotes'
import { InvoicesPage } from '@/features/invoices'
import { SchedulingPage } from '@/features/scheduling'
import { JobLogsListPage, JobLogDetailPage } from '@/features/jobLogs'
import { PublicBookingPage } from '@/features/booking'
import { SettingsPage, ProfileSettingsPage } from '@/features/settings'
import { QuoteApprovalPage, InvoiceApprovalPage, QuoteViewPage, InvoiceViewPage, ShortLinkRedirect } from '@/features/publicApproval'
import { ReportsPage } from '@/features/reports'
import {
  LandingPage,
  RequestAccessPage,
  PrivacyPolicyPage,
  TermsOfServicePage,
  AboutPage,
  EmailPolicyPage,
  SmsConsentPage,
} from '@/features/marketing'
import { OnboardingPage, OnboardingManager, AppTourOverlay } from '@/features/onboarding'

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

const ALL_SIDEBAR_ITEMS = [
  { label: 'Dashboard', href: '/app' },
  { label: 'Contacts', href: '/app/crm' },
  { label: 'Quotes', href: '/app/quotes' },
  { label: 'Jobs', href: '/app/job-logs' },
  { label: 'Invoices', href: '/app/invoices' },
  { label: 'Calendar', href: '/app/scheduling' },
  { label: 'Reports', href: '/app/reports' },
  { label: 'Settings', href: '/app/settings' },
] as const

const EMPLOYEE_SIDEBAR_ITEMS = [
  { label: 'Dashboard', href: '/app' },
  { label: 'Jobs', href: '/app/job-logs' },
  { label: 'Calendar', href: '/app/scheduling' },
  { label: 'Profile', href: '/app/profile' },
] as const

function App() {
  const { user, logout, isAuthenticated } = useAuthStore()

  const sidebarItems =
    user?.role === 'employee'
      ? [...EMPLOYEE_SIDEBAR_ITEMS]
      : [...ALL_SIDEBAR_ITEMS]

  const handleLogout = async () => {
    await logout()
  }

  return (
    <BrowserRouter>
      <ScrollToTop />
      <SessionMonitor />
      <OnboardingManager />
      <AppTourOverlay />
      <Routes>
        {/* Public Marketing Pages */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/request-access" element={<RequestAccessPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/sms-consent" element={<SmsConsentPage />} />
        <Route path="/email-policy" element={<EmailPolicyPage />} />

        {/* Public Booking Routes - No authentication required */}
        <Route path="/book" element={<PublicBookingPage />} />
        <Route path="/book/:serviceId" element={<PublicBookingPage />} />

        {/* Short link redirect (for SMS) */}

        <Route path="/s/:code" element={<ShortLinkRedirect />} />
        {/* Public Approval Routes - No authentication required */}
        <Route path="/public/quote/:id" element={<QuoteViewPage />} />
        <Route path="/public/quote/:id/:action" element={<QuoteApprovalPage />} />
        <Route path="/public/invoice/:id" element={<InvoiceViewPage />} />
        <Route path="/public/invoice/:id/:action" element={<InvoiceApprovalPage />} />

        {/* Auth Routes - Always render, let pages handle redirect */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

        {/* Onboarding Route - Protected but no sidebar */}
        <Route
          path="/app/onboarding"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />

        {/* Protected App Routes - All under /app */}
        <Route
          path="/app"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AdminRoute userRole={user?.role}>
                <BillingGuard>
                  <AppLayout
                    sidebarItems={sidebarItems}
                    user={user ? { name: user.name, email: user.email, role: user.role } : undefined}
                    onLogout={handleLogout}
                  >
                    <DashboardPage />
                  </AppLayout>
                </BillingGuard>
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/crm"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AdminRoute userRole={user?.role}>
                <BillingGuard>
                  <AppLayout
                  sidebarItems={sidebarItems}
                  user={user ? { name: user.name, email: user.email, role: user.role } : undefined}
                  onLogout={handleLogout}
                >
                  <CRMPage />
                </AppLayout>
                </BillingGuard>
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/quotes"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AdminRoute userRole={user?.role}>
                <BillingGuard>
                  <AppLayout
                  sidebarItems={sidebarItems}
                  user={user ? { name: user.name, email: user.email, role: user.role } : undefined}
                  onLogout={handleLogout}
                >
                  <QuotesPage />
                </AppLayout>
                </BillingGuard>
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/invoices"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AdminRoute userRole={user?.role}>
                <BillingGuard>
                  <AppLayout
                  sidebarItems={sidebarItems}
                  user={user ? { name: user.name, email: user.email, role: user.role } : undefined}
                  onLogout={handleLogout}
                >
                  <InvoicesPage />
                </AppLayout>
                </BillingGuard>
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/scheduling"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AdminRoute userRole={user?.role}>
                <BillingGuard>
                  <AppLayout
                  sidebarItems={sidebarItems}
                  user={user ? { name: user.name, email: user.email, role: user.role } : undefined}
                  onLogout={handleLogout}
                >
                  <SchedulingPage />
                </AppLayout>
                </BillingGuard>
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/job-logs"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <BillingGuard>
                <AppLayout
                  sidebarItems={sidebarItems}
                  user={user ? { name: user.name, email: user.email, role: user.role } : undefined}
                  onLogout={handleLogout}
                >
                  <JobLogsListPage />
                </AppLayout>
              </BillingGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/job-logs/:id"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <BillingGuard>
                <AppLayout
                  sidebarItems={sidebarItems}
                  user={user ? { name: user.name, email: user.email, role: user.role } : undefined}
                  onLogout={handleLogout}
                >
                  <JobLogDetailPage />
                </AppLayout>
              </BillingGuard>
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/profile"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              {user?.role === 'employee' ? (
                <BillingGuard>
                  <AppLayout
                    sidebarItems={sidebarItems}
                    user={user ? { name: user.name, email: user.email, role: user.role } : undefined}
                    onLogout={handleLogout}
                  >
                    <ProfileSettingsPage />
                  </AppLayout>
                </BillingGuard>
              ) : (
                <Navigate to="/app/settings" replace />
              )}
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/reports"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AdminRoute userRole={user?.role}>
                <BillingGuard>
                  <AppLayout
                    sidebarItems={sidebarItems}
                    user={user ? { name: user.name, email: user.email, role: user.role } : undefined}
                    onLogout={handleLogout}
                  >
                    <ReportsPage />
                  </AppLayout>
                </BillingGuard>
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/settings"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AdminRoute userRole={user?.role}>
                <BillingGuard>
                  <AppLayout
                    sidebarItems={sidebarItems}
                    user={user ? { name: user.name, email: user.email, role: user.role } : undefined}
                    onLogout={handleLogout}
                  >
                    <SettingsPage />
                  </AppLayout>
                </BillingGuard>
              </AdminRoute>
            </ProtectedRoute>
          }
        />

        {/* Redirect unknown routes */}
        <Route path="*" element={<Navigate to={isAuthenticated ? '/app' : '/'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
