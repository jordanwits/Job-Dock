import { useRef } from 'react'
import { Button } from '@/components/ui'
import { TenantSettings } from '@/lib/api/settings'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

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
  const { theme } = useTheme()
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
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className={cn(
          "text-xl font-semibold",
          theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
        )}>PDF Templates</h2>
        <p className={cn(
          "text-sm",
          theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
        )}>
          Upload custom PDF backgrounds for invoices and quotes. Your template will be used as the background with dynamic content overlaid. Max size: 10MB per file.
        </p>
      </div>

      <div className="space-y-6">
        {/* Invoice PDF Template */}
        <div>
          <h3 className={cn(
            "text-lg font-medium mb-3",
            theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
          )}>
            Invoice Template
          </h3>

          {settings?.invoicePdfTemplateKey && (
            <div className={cn(
              "mb-3 p-4 rounded-lg",
              theme === 'dark' ? 'bg-primary-dark-secondary' : 'bg-gray-100'
            )}>
              <p className={cn(
                "text-sm mb-2",
                theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
              )}>
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
          <h3 className={cn(
            "text-lg font-medium mb-3",
            theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
          )}>
            Quote Template
          </h3>

          {settings?.quotePdfTemplateKey && (
            <div className={cn(
              "mb-3 p-4 rounded-lg",
              theme === 'dark' ? 'bg-primary-dark-secondary' : 'bg-gray-100'
            )}>
              <p className={cn(
                "text-sm mb-2",
                theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
              )}>
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
    </div>
  )
}

