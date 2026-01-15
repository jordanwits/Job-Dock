import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout, ProtectedRoute } from '@/components'
import SessionMonitor from '@/components/SessionMonitor'
import { LoginPage, RegisterPage, ResetPasswordPage, useAuthStore } from '@/features/auth'
import { DashboardPage } from '@/features/dashboard'
import { CRMPage } from '@/features/crm'
import { QuotesPage } from '@/features/quotes'
import { InvoicesPage } from '@/features/invoices'
import { SchedulingPage } from '@/features/scheduling'
import { PublicBookingPage } from '@/features/booking'
import { SettingsPage } from '@/features/settings'
import { QuoteApprovalPage, InvoiceApprovalPage } from '@/features/publicApproval'
import { LandingPage, PrivacyPolicyPage, TermsOfServicePage, EmailPolicyPage } from '@/features/marketing'

function App() {
  const { user, logout, isAuthenticated } = useAuthStore()

  const sidebarItems = [
    { label: 'Dashboard', href: '/app' },
    { label: 'CRM', href: '/app/crm' },
    { label: 'Quotes', href: '/app/quotes' },
    { label: 'Invoices', href: '/app/invoices' },
    { label: 'Calendar', href: '/app/scheduling' },
    { label: 'Settings', href: '/app/settings' },
  ]

  const handleLogout = async () => {
    await logout()
  }

  return (
    <BrowserRouter>
      <SessionMonitor />
      <Routes>
        {/* Public Marketing Pages */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/email-policy" element={<EmailPolicyPage />} />

        {/* Public Booking Routes - No authentication required */}
        <Route path="/book" element={<PublicBookingPage />} />
        <Route path="/book/:serviceId" element={<PublicBookingPage />} />

        {/* Public Approval Routes - No authentication required */}
        <Route path="/public/quote/:id/:action" element={<QuoteApprovalPage />} />
        <Route path="/public/invoice/:id/:action" element={<InvoiceApprovalPage />} />

        {/* Auth Routes - Always render, let pages handle redirect */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

        {/* Protected App Routes - All under /app */}
        <Route
          path="/app"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AppLayout
                sidebarItems={sidebarItems}
                user={user ? { name: user.name, email: user.email } : undefined}
                onLogout={handleLogout}
              >
                <DashboardPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/crm"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AppLayout
                sidebarItems={sidebarItems}
                user={user ? { name: user.name, email: user.email } : undefined}
                onLogout={handleLogout}
              >
                <CRMPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/quotes"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AppLayout
                sidebarItems={sidebarItems}
                user={user ? { name: user.name, email: user.email } : undefined}
                onLogout={handleLogout}
              >
                <QuotesPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/invoices"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AppLayout
                sidebarItems={sidebarItems}
                user={user ? { name: user.name, email: user.email } : undefined}
                onLogout={handleLogout}
              >
                <InvoicesPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/scheduling"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AppLayout
                sidebarItems={sidebarItems}
                user={user ? { name: user.name, email: user.email } : undefined}
                onLogout={handleLogout}
              >
                <SchedulingPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/settings"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <AppLayout
                sidebarItems={sidebarItems}
                user={user ? { name: user.name, email: user.email } : undefined}
                onLogout={handleLogout}
              >
                <SettingsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Redirect unknown routes */}
        <Route
          path="*"
          element={
            <Navigate to={isAuthenticated ? '/app' : '/'} replace />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App

