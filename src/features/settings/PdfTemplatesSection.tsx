import { useRef } from 'react'
import { TenantSettings } from '@/lib/api/settings'
import {
  AppButton,
  SettingsSection,
  SubHeading,
  InfoPanel,
  UploadIcon,
  ExternalLinkIcon,
  linkCls,
} from './settingsUi'

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
    <SettingsSection
      title="PDF Templates"
      description="Upload custom PDF backgrounds for invoices and quotes. Your template will be used as the background with dynamic content overlaid. Max size: 10MB per file."
    >
      <div className="space-y-8">
        {/* Invoice PDF Template */}
        <div>
          <SubHeading className="mb-3">Invoice template</SubHeading>

          {settings?.invoicePdfTemplateKey && (
            <InfoPanel className="mb-3">
              <p className="mb-2 text-ink">
                Current template:{' '}
                <span className="font-medium text-accent-strong">
                  {settings.invoicePdfTemplateKey.split('/').pop()}
                </span>
              </p>
              {settings.invoicePdfSignedUrl && (
                <a
                  href={settings.invoicePdfSignedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 text-[13px] ${linkCls}`}
                >
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                  Preview template
                </a>
              )}
            </InfoPanel>
          )}

          <input
            ref={invoiceFileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleInvoiceFileSelect}
            className="hidden"
          />

          <AppButton variant="subtle" onClick={() => invoiceFileInputRef.current?.click()}>
            <UploadIcon className="h-4 w-4" />
            {settings?.invoicePdfTemplateKey ? 'Change invoice template' : 'Upload invoice template'}
          </AppButton>
        </div>

        {/* Quote PDF Template */}
        <div>
          <SubHeading className="mb-3">Quote template</SubHeading>

          {settings?.quotePdfTemplateKey && (
            <InfoPanel className="mb-3">
              <p className="mb-2 text-ink">
                Current template:{' '}
                <span className="font-medium text-accent-strong">
                  {settings.quotePdfTemplateKey.split('/').pop()}
                </span>
              </p>
              {settings.quotePdfSignedUrl && (
                <a
                  href={settings.quotePdfSignedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 text-[13px] ${linkCls}`}
                >
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                  Preview template
                </a>
              )}
            </InfoPanel>
          )}

          <input
            ref={quoteFileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleQuoteFileSelect}
            className="hidden"
          />

          <AppButton variant="subtle" onClick={() => quoteFileInputRef.current?.click()}>
            <UploadIcon className="h-4 w-4" />
            {settings?.quotePdfTemplateKey ? 'Change quote template' : 'Upload quote template'}
          </AppButton>
        </div>
      </div>
    </SettingsSection>
  )
}
