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

function App() {
  const { user, logout, isAuthenticated } = useAuthStore()

  const sidebarItems = [
    { label: 'Dashboard', href: '/' },
    { label: 'CRM', href: '/crm' },
    { label: 'Quotes', href: '/quotes' },
    { label: 'Invoices', href: '/invoices' },
    { label: 'Calendar', href: '/scheduling' },
    { label: 'Settings', href: '/settings' },
  ]

  const handleLogout = async () => {
    await logout()
  }

  return (
    <BrowserRouter>
      <SessionMonitor />
      <Routes>
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

        {/* Protected Routes */}
        <Route
          path="/"
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
          path="/crm"
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
          path="/quotes"
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
          path="/invoices"
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
          path="/scheduling"
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
          path="/settings"
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
            <Navigate to={isAuthenticated ? '/' : '/auth/login'} replace />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App

