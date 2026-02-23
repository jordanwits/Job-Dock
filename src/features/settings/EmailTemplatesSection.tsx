import { useState } from 'react'
import { Input, Textarea, Button } from '@/components/ui'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

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
  const { theme } = useTheme()
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
    <div className="space-y-6">
      <h2 className={cn(
        "text-xl font-semibold",
        theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
      )}>Email Templates</h2>
      <div className={cn(
        "mb-6 p-4 rounded-lg",
        theme === 'dark' ? 'bg-primary-dark-secondary' : 'bg-gray-100'
      )}>
        <p className={cn(
          "text-sm mb-2",
          theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
        )}>
          Available variables you can use in your templates:
        </p>
        <div className="flex flex-wrap gap-2">
          {availableVariables.map((variable) => (
            <code
              key={variable}
              className={cn(
                "px-2 py-1 rounded text-xs",
                theme === 'dark'
                  ? 'bg-primary-dark text-primary-gold'
                  : 'bg-white text-primary-gold border border-gray-200'
              )}
            >
              {variable}
            </code>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {/* Invoice Email Template */}
        <div className="space-y-4">
          <h3 className={cn(
            "text-lg font-medium",
            theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
          )}>
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
          <h3 className={cn(
            "text-lg font-medium",
            theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
          )}>
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

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}

