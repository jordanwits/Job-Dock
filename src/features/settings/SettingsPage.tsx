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
      <div className="space-y-6">
        <div className="rounded-xl border border-white/5 bg-primary-dark-secondary/50 p-6 shadow-sm shadow-black/20">
          <div className="h-6 w-48 bg-primary-dark rounded animate-pulse mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-primary-dark rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-primary-light tracking-tight">
          <span className="text-primary-gold">Settings</span>
        </h1>
        <p className="text-primary-light/60">
          Manage your company branding, email templates, and PDF templates
        </p>
      </div>

      {error && (
        <Card className="bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20">
          <p className="text-red-400">{error}</p>
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

