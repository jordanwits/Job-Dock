import { useState, useEffect } from 'react'
import { Card } from '@/components/ui'
import { settingsApi, TenantSettings } from '@/lib/api/settings'
import { CompanyBrandingSection } from './CompanyBrandingSection'
import { EmailTemplatesSection } from './EmailTemplatesSection'
import { PdfTemplatesSection } from './PdfTemplatesSection'

export const SettingsPage = () => {
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

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
    setFormData((prev) => ({ ...prev, [field]: value }))
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-primary-light/70">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary-gold mb-2">Settings</h1>
        <p className="text-primary-light/70">
          Manage your company branding, email templates, and PDF templates
        </p>
      </div>

      {error && (
        <Card className="bg-red-500/10 border-red-500">
          <p className="text-red-500">{error}</p>
        </Card>
      )}

      <CompanyBrandingSection
        formData={formData}
        settings={settings}
        onFieldChange={handleFieldChange}
        onLogoUpload={handleLogoUpload}
        onSave={handleSave}
      />

      <EmailTemplatesSection
        formData={formData}
        onFieldChange={handleFieldChange}
        onSave={handleSave}
      />

      <PdfTemplatesSection
        settings={settings}
        onInvoicePdfUpload={handleInvoicePdfUpload}
        onQuotePdfUpload={handleQuotePdfUpload}
      />
    </div>
  )
}

