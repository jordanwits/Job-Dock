import { useRef, useState } from 'react'
import { TenantSettings } from '@/lib/api/settings'
import {
  AppButton,
  TextField,
  PhoneField,
  SelectField,
  SettingsSection,
  UploadIcon,
} from './settingsUi'

// Common US business timezones. IANA ids so local times stay DST-correct. Empty value = "not set",
// which the backend treats as the legacy Pacific default.
const TIMEZONE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Not set — defaults to Pacific (PT)' },
  { value: 'America/New_York', label: 'Eastern (New York)' },
  { value: 'America/Chicago', label: 'Central (Chicago)' },
  { value: 'America/Denver', label: 'Mountain (Denver)' },
  { value: 'America/Phoenix', label: 'Arizona — no DST (Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska (Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (Honolulu)' },
]

interface CompanyBrandingSectionProps {
  formData: {
    companyDisplayName: string
    companySupportEmail: string
    companyPhone: string
    timezone: string
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
    <SettingsSection title="Company & Branding">
      <div className="space-y-4">
        <TextField
          label="Company name"
          value={formData.companyDisplayName}
          onChange={e => onFieldChange('companyDisplayName', e.target.value)}
          placeholder="Your Company Name"
        />

        <TextField
          label="Support email"
          type="email"
          value={formData.companySupportEmail}
          onChange={e => onFieldChange('companySupportEmail', e.target.value)}
          placeholder="support@yourcompany.com"
          helperText="Displayed in email footers and on invoices/quotes"
        />

        <PhoneField
          label="Phone number"
          value={formData.companyPhone}
          onChange={e => onFieldChange('companyPhone', e.target.value)}
          placeholder="123-456-7890"
          helperText="Displayed on invoices and quotes for customer contact"
        />

        <SelectField
          label="Timezone"
          value={formData.timezone}
          onChange={e => onFieldChange('timezone', e.target.value)}
          options={TIMEZONE_OPTIONS}
          placeholder="Not set — defaults to Pacific (PT)"
          helperText="Used for the times shown on your online booking page and in appointment confirmation emails and texts"
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Company logo</label>
          <p className="mb-3 text-[13px] leading-relaxed text-ink-subtle">
            Upload your company logo. It will appear on invoices, quotes, and emails. Supported
            formats: PNG, JPEG, SVG. Max size: 5MB.
          </p>

          {settings?.logoSignedUrl && (
            <div className="mb-3 rounded-lg bg-surface-2 p-4">
              <img src={settings.logoSignedUrl} alt="Company logo" className="max-h-24 object-contain" />
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
            onChange={handleFileSelect}
            className="hidden"
          />

          <AppButton variant="subtle" onClick={() => fileInputRef.current?.click()} isLoading={uploadingLogo}>
            {!uploadingLogo && <UploadIcon className="h-4 w-4" />}
            {uploadingLogo ? 'Uploading…' : settings?.logoUrl ? 'Change logo' : 'Upload logo'}
          </AppButton>
        </div>

        <div className="flex justify-end pt-4">
          <AppButton onClick={handleSave} isLoading={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </AppButton>
        </div>
      </div>
    </SettingsSection>
  )
}
