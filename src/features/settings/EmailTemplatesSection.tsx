import { useState } from 'react'
import { Card, Input, Textarea, Button } from '@/components/ui'

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
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-primary-light">
          Email Templates
        </h2>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <div className="mb-6 p-4 bg-primary-dark-secondary rounded-lg">
        <p className="text-sm text-primary-light/70 mb-2">
          Available variables you can use in your templates:
        </p>
        <div className="flex flex-wrap gap-2">
          {availableVariables.map((variable) => (
            <code
              key={variable}
              className="px-2 py-1 bg-primary-dark text-primary-gold rounded text-xs"
            >
              {variable}
            </code>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {/* Invoice Email Template */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-primary-light">
            Invoice Email
          </h3>

          <Input
            label="Subject"
            value={formData.invoiceEmailSubject}
            onChange={(e) => onFieldChange('invoiceEmailSubject', e.target.value)}
            placeholder="Your Invoice from {{company_name}}"
          />

          <Textarea
            label="Body"
            value={formData.invoiceEmailBody}
            onChange={(e) => onFieldChange('invoiceEmailBody', e.target.value)}
            placeholder="Hi {{customer_name}},&#10;&#10;Please find attached invoice {{invoice_number}}.&#10;&#10;Thank you for your business!"
            rows={6}
          />
        </div>

        {/* Quote Email Template */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-primary-light">
            Quote Email
          </h3>

          <Input
            label="Subject"
            value={formData.quoteEmailSubject}
            onChange={(e) => onFieldChange('quoteEmailSubject', e.target.value)}
            placeholder="Your Quote from {{company_name}}"
          />

          <Textarea
            label="Body"
            value={formData.quoteEmailBody}
            onChange={(e) => onFieldChange('quoteEmailBody', e.target.value)}
            placeholder="Hi {{customer_name}},&#10;&#10;Please find attached quote {{quote_number}}.&#10;&#10;We look forward to working with you!"
            rows={6}
          />
        </div>
      </div>
    </Card>
  )
}

