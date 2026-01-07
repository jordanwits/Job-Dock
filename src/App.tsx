import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout, ProtectedRoute } from '@/components'
import { LoginPage, RegisterPage, ResetPasswordPage, useAuthStore } from '@/features/auth'
import { CRMPage } from '@/features/crm'
import { QuotesPage } from '@/features/quotes'
import { InvoicesPage } from '@/features/invoices'
import { SchedulingPage } from '@/features/scheduling'
import { PublicBookingPage } from '@/features/booking'
import { Card, Button, Input, Modal } from '@/components/ui'
import { useState } from 'react'

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { user, logout, isAuthenticated } = useAuthStore()

  const sidebarItems = [
    { label: 'Dashboard', href: '/' },
    { label: 'CRM', href: '/crm' },
    { label: 'Quotes', href: '/quotes' },
    { label: 'Invoices', href: '/invoices' },
    { label: 'Scheduling', href: '/scheduling' },
  ]

  const DashboardContent = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary-gold mb-2">
          Welcome to JobDock{user ? `, ${user.name}` : ''}
        </h1>
        <p className="text-primary-light/70">
          Your contractor management platform is taking shape! Core features are implemented and ready to use.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-xl font-semibold text-primary-light mb-4">
            Design System
          </h2>
          <p className="text-primary-light/70 mb-4">
            Essential UI components are ready to use.
          </p>
          <div className="space-y-4">
            <Input label="Example Input" placeholder="Enter text..." />
            <Button onClick={() => setIsModalOpen(true)}>Open Modal</Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold text-primary-light mb-4">Progress</h2>
          <ul className="space-y-2 text-primary-light/70">
            <li>✅ Project foundation setup</li>
            <li>✅ Design system components</li>
            <li>✅ Custom UI components (Checkbox, Select, DatePicker, TimePicker)</li>
            <li>✅ Layout components</li>
            <li>✅ Authentication system</li>
            <li>✅ CRM system</li>
            <li>✅ Quotes system (with convert to invoice)</li>
            <li>✅ Invoices system</li>
            <li>✅ Scheduling system (Calendar, Jobs, Services)</li>
            <li>✅ Mobile-responsive design improvements</li>
            <li>⏭️ AWS infrastructure</li>
            <li>⏭️ Backend API integration</li>
            <li>⏭️ Advanced features (notifications, reports)</li>
          </ul>
        </Card>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Example Modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsModalOpen(false)}>Confirm</Button>
          </>
        }
      >
        <p className="text-primary-light">
          This is an example modal component. You can use it for dialogs,
          confirmations, and forms.
        </p>
      </Modal>
    </div>
  )

  const handleLogout = async () => {
    await logout()
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Booking Routes - No authentication required */}
        <Route path="/book" element={<PublicBookingPage />} />
        <Route path="/book/:serviceId" element={<PublicBookingPage />} />

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
                <DashboardContent />
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

