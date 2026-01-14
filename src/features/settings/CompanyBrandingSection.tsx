import { useRef, useState } from 'react'
import { Input, Button, PhoneInput } from '@/components/ui'
import { TenantSettings } from '@/lib/api/settings'
import { CollapsibleSection } from './CollapsibleSection'

interface CompanyBrandingSectionProps {
  formData: {
    companyDisplayName: string
    companySupportEmail: string
    companyPhone: string
  }
  settings: TenantSettings | null
  onFieldChange: (field: string, value: string) => void
  onLogoUpload: (file: File) => Promise<void>
  onSave: () => Promise<void>
}

export const CompanyBrandingSection = ({
  formData,
  settings,
  onFieldChange,
  onLogoUpload,
  onSave,
}: CompanyBrandingSectionProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadingLogo(true)
      try {
        await onLogoUpload(file)
      } finally {
        setUploadingLogo(false)
        // Reset input so the same file can be selected again
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <CollapsibleSection title="Company & Branding">
      <div className="space-y-4">
        <Input
          label="Company Name"
          value={formData.companyDisplayName}
          onChange={(e) => onFieldChange('companyDisplayName', e.target.value)}
          placeholder="Your Company Name"
        />

        <Input
          label="Support Email"
          type="email"
          value={formData.companySupportEmail}
          onChange={(e) => onFieldChange('companySupportEmail', e.target.value)}
          placeholder="support@yourcompany.com"
          helperText="Displayed in email footers and on invoices/quotes"
        />

        <PhoneInput
          label="Phone Number"
          value={formData.companyPhone}
          onChange={(e) => onFieldChange('companyPhone', e.target.value)}
          placeholder="123-456-7890"
          helperText="Displayed on invoices and quotes for customer contact"
        />

        <div>
          <label className="block text-sm font-medium text-primary-light mb-2">
            Company Logo
          </label>
          <p className="text-sm text-primary-light/70 mb-3">
            Upload your company logo. It will appear on invoices, quotes, and emails.
            Supported formats: PNG, JPEG, SVG. Max size: 5MB.
          </p>

          {settings?.logoSignedUrl && (
            <div className="mb-3 p-4 bg-primary-dark-secondary rounded-lg">
              <img
                src={settings.logoSignedUrl}
                alt="Company logo"
                className="max-h-24 object-contain"
              />
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
            onChange={handleFileSelect}
            className="hidden"
          />

          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingLogo}
          >
            {uploadingLogo ? 'Uploading...' : settings?.logoUrl ? 'Change Logo' : 'Upload Logo'}
          </Button>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </CollapsibleSection>
  )
}

