import { useState } from 'react'
import {
  AppButton,
  TextField,
  TextAreaField,
  SettingsSection,
  SubHeading,
  InfoPanel,
  CodeChip,
} from './settingsUi'

interface EmailTemplatesSectionProps {
  formData: {
    invoiceEmailSubject: string
    invoiceEmailBody: string
    quoteEmailSubject: string
    quoteEmailBody: string
  }
  onFieldChange: (field: string, value: string) => void
  onSave: () => Promise<void>
}

export const EmailTemplatesSection = ({
  formData,
  onFieldChange,
  onSave,
}: EmailTemplatesSectionProps) => {
  const [saving, setSaving] = useState(false)

  const availableVariables = [
    '{{company_name}}',
    '{{customer_name}}',
    '{{invoice_number}}',
    '{{quote_number}}',
  ]

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection title="Email Templates">
      <InfoPanel>
        <p className="mb-2.5">Available variables you can use in your templates:</p>
        <div className="flex flex-wrap gap-2">
          {availableVariables.map(variable => (
            <CodeChip key={variable}>{variable}</CodeChip>
          ))}
        </div>
      </InfoPanel>

      <div className="space-y-8">
        {/* Invoice Email Template */}
        <div className="space-y-4">
          <SubHeading>Invoice email</SubHeading>
          <TextField
            label="Subject"
            value={formData.invoiceEmailSubject}
            onChange={e => onFieldChange('invoiceEmailSubject', e.target.value)}
            placeholder="Your Invoice from {{company_name}}"
          />
          <TextAreaField
            label="Body"
            value={formData.invoiceEmailBody}
            onChange={e => onFieldChange('invoiceEmailBody', e.target.value)}
            placeholder="Hi {{customer_name}}, please find your invoice attached."
            rows={6}
          />
        </div>

        {/* Quote Email Template */}
        <div className="space-y-4">
          <SubHeading>Quote email</SubHeading>
          <TextField
            label="Subject"
            value={formData.quoteEmailSubject}
            onChange={e => onFieldChange('quoteEmailSubject', e.target.value)}
            placeholder="Your Quote from {{company_name}}"
          />
          <TextAreaField
            label="Body"
            value={formData.quoteEmailBody}
            onChange={e => onFieldChange('quoteEmailBody', e.target.value)}
            placeholder="Hi {{customer_name}}, please find your quote attached."
            rows={6}
          />
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
