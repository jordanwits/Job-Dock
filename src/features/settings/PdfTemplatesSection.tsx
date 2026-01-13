import { useRef } from 'react'
import { Button } from '@/components/ui'
import { TenantSettings } from '@/lib/api/settings'
import { CollapsibleSection } from './CollapsibleSection'

interface PdfTemplatesSectionProps {
  settings: TenantSettings | null
  onInvoicePdfUpload: (file: File) => Promise<void>
  onQuotePdfUpload: (file: File) => Promise<void>
}

export const PdfTemplatesSection = ({
  settings,
  onInvoicePdfUpload,
  onQuotePdfUpload,
}: PdfTemplatesSectionProps) => {
  const invoiceFileInputRef = useRef<HTMLInputElement>(null)
  const quoteFileInputRef = useRef<HTMLInputElement>(null)

  const handleInvoiceFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await onInvoicePdfUpload(file)
      if (invoiceFileInputRef.current) {
        invoiceFileInputRef.current.value = ''
      }
    }
  }

  const handleQuoteFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await onQuotePdfUpload(file)
      if (quoteFileInputRef.current) {
        quoteFileInputRef.current.value = ''
      }
    }
  }

  return (
    <CollapsibleSection title="PDF Templates">
      <p className="text-sm text-primary-light/70 mb-6">
        Upload custom PDF backgrounds or letterheads for your invoices and quotes.
        The system will use your template as the background and automatically overlay dynamic content
        (invoice/quote numbers, customer details, line items, totals, etc.) on top of it.
        This allows you to use your professionally designed letterhead while keeping all data up-to-date.
        Max size: 10MB per file.
      </p>

      <div className="space-y-6">
        {/* Invoice PDF Template */}
        <div>
          <h3 className="text-lg font-medium text-primary-light mb-3">
            Invoice Template
          </h3>

          {settings?.invoicePdfTemplateKey && (
            <div className="mb-3 p-4 bg-primary-dark-secondary rounded-lg">
              <p className="text-sm text-primary-light mb-2">
                Current template: <span className="text-primary-gold">{settings.invoicePdfTemplateKey.split('/').pop()}</span>
              </p>
              {settings.invoicePdfSignedUrl && (
                <a
                  href={settings.invoicePdfSignedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-blue hover:underline"
                >
                  Preview Template
                </a>
              )}
            </div>
          )}

          <input
            ref={invoiceFileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleInvoiceFileSelect}
            className="hidden"
          />

          <Button
            variant="outline"
            onClick={() => invoiceFileInputRef.current?.click()}
          >
            {settings?.invoicePdfTemplateKey ? 'Change Invoice Template' : 'Upload Invoice Template'}
          </Button>
        </div>

        {/* Quote PDF Template */}
        <div>
          <h3 className="text-lg font-medium text-primary-light mb-3">
            Quote Template
          </h3>

          {settings?.quotePdfTemplateKey && (
            <div className="mb-3 p-4 bg-primary-dark-secondary rounded-lg">
              <p className="text-sm text-primary-light mb-2">
                Current template: <span className="text-primary-gold">{settings.quotePdfTemplateKey.split('/').pop()}</span>
              </p>
              {settings.quotePdfSignedUrl && (
                <a
                  href={settings.quotePdfSignedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-blue hover:underline"
                >
                  Preview Template
                </a>
              )}
            </div>
          )}

          <input
            ref={quoteFileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleQuoteFileSelect}
            className="hidden"
          />

          <Button
            variant="outline"
            onClick={() => quoteFileInputRef.current?.click()}
          >
            {settings?.quotePdfTemplateKey ? 'Change Quote Template' : 'Upload Quote Template'}
          </Button>
        </div>
      </div>
    </CollapsibleSection>
  )
}

