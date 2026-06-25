import { Quote, QuoteStatus } from '../types/quote'
import { useQuoteStore } from '../store/quoteStore'
import { useInvoiceStore } from '@/features/invoices/store/invoiceStore'
import { useState } from 'react'
import QuoteForm from './QuoteForm'
import ConvertQuoteToInvoiceModal from './ConvertQuoteToInvoiceModal'
import CreateJobFromQuoteModal from './CreateJobFromQuoteModal'
import { useNavigate } from 'react-router-dom'
import { getErrorMessage } from '@/lib/utils/errorHandler'
import { getSendValidationError } from '@/lib/utils/sendValidation'
import {
  Alert,
  AlertIcon,
  AppButton,
  AppModal,
  CheckIcon,
  ClipboardIcon,
  ReceiptIcon,
  SendIcon,
  StatusSelect,
} from './quotesUi'
import { QUOTE_STATUS_OPTIONS } from './quoteStatus'

interface QuoteDetailProps {
  quote: Quote
  isOpen: boolean
  onClose: () => void
  onJobCreated?: () => void
  onJobCreateFailed?: (error: string) => void
  onQuoteSent?: (message: string) => void
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

const QuoteDetail = ({
  quote,
  isOpen,
  onClose,
  onJobCreated,
  onQuoteSent,
}: QuoteDetailProps) => {
  const { updateQuote, deleteQuote, sendQuote, isLoading } = useQuoteStore()
  const { convertQuoteToInvoice, setSelectedInvoice, isLoading: isConverting } = useInvoiceStore()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [showCreateJob, setShowCreateJob] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const [showJobConfirmation, setShowJobConfirmation] = useState(false)
  const [lastSentVia, setLastSentVia] = useState<string[] | null>(null)

  const handleUpdate = async (data: any) => {
    try {
      await updateQuote({ id: quote.id, ...data })
      setIsEditing(false)
      setConfirmationMessage('Quote updated successfully')
      setShowConfirmation(true)
      setTimeout(() => setShowConfirmation(false), 3000)
    } catch (error) {
      // Error handled by store
    }
  }

  const handleDelete = async () => {
    try {
      await deleteQuote(quote.id)
      setShowDeleteConfirm(false)
      onClose()
    } catch (error) {
      // Error handled by store
    }
  }

  const handleConvertToInvoice = async (options: { paymentTerms: string; dueDate: string }) => {
    try {
      const invoice = await convertQuoteToInvoice(quote, options)
      await deleteQuote(quote.id)
      setShowConvertModal(false)
      setConfirmationMessage('Quote converted to invoice')
      setShowConfirmation(true)
      setTimeout(() => {
        setShowConfirmation(false)
        onClose()
        // Set the newly created invoice as selected and navigate to invoices page
        setSelectedInvoice(invoice)
        navigate(`/app/invoices`)
      }, 2000)
    } catch (error) {
      // Error handled by store
    }
  }

  const handleSend = async () => {
    setSendError(null)
    setSendSuccess(false)
    const validationError = getSendValidationError({
      contactEmail: quote.contactEmail,
      contactPhone: quote.contactPhone?.trim(),
      contactNotificationPreference: quote.contactNotificationPreference || 'both',
    })
    if (validationError) {
      setSendError(validationError)
      setTimeout(() => setSendError(null), 5000)
      return
    }
    setIsSending(true)
    try {
      const updatedQuote = await sendQuote(quote.id)
      const sentVia = updatedQuote?.sentVia
      setLastSentVia(updatedQuote?.sentVia ?? [])
      if (sentVia && sentVia.length > 0) {
        const viaText = sentVia.includes('email') && sentVia.includes('sms')
          ? ` via email and SMS to ${updatedQuote?.contactEmail || updatedQuote?.contactPhone || 'contact'}`
          : sentVia.includes('sms')
            ? ` via SMS to ${updatedQuote?.contactPhone || 'contact'}`
            : ` via email to ${updatedQuote?.contactEmail || 'contact'}`
        onQuoteSent?.(`Quote sent successfully${viaText}`)
        onClose()
      } else {
        setSendSuccess(true)
        setTimeout(() => setSendSuccess(false), 3000)
      }
    } catch (error: unknown) {
      setSendError(getErrorMessage(error, 'Failed to send quote'))
      setTimeout(() => setSendError(null), 5000)
    } finally {
      setIsSending(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateQuote({ id: quote.id, status: newStatus as QuoteStatus })
    } catch (error) {
      // Error handled by store
    }
  }

  if (isEditing) {
    return (
      <AppModal
        isOpen={isOpen}
        onClose={() => {
          setIsEditing(false)
          onClose()
        }}
        title="Edit quote"
        size="xl"
      >
        <QuoteForm
          quote={quote}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditing(false)}
          isLoading={isLoading}
        />
      </AppModal>
    )
  }

  const taxAmount = quote.taxAmount ?? quote.subtotal * (quote.taxRate || 0)

  return (
    <>
      <AppModal
        isOpen={isOpen}
        onClose={onClose}
        title={
          quote.contactName && quote.title
            ? `${quote.contactName} — ${quote.title}`
            : quote.contactName || quote.title || quote.quoteNumber
        }
        size="lg"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <AppButton variant="dangerGhost" onClick={() => setShowDeleteConfirm(true)} className="order-3 sm:order-1">
              Delete
            </AppButton>
            <div className="order-1 flex flex-col gap-2 sm:order-2 sm:flex-row sm:gap-3">
              <AppButton variant="subtle" onClick={() => setShowCreateJob(true)} fullWidth className="sm:w-auto">
                <ClipboardIcon className="h-4 w-4" />
                Create job
              </AppButton>
              {quote.status !== 'rejected' && quote.status !== 'expired' && (
                <AppButton variant="subtle" onClick={() => setShowConvertModal(true)} fullWidth className="sm:w-auto">
                  <ReceiptIcon className="h-4 w-4" />
                  Convert to invoice
                </AppButton>
              )}
              <AppButton variant="subtle" onClick={() => setIsEditing(true)} fullWidth className="sm:w-auto">
                Edit
              </AppButton>
              <AppButton onClick={handleSend} disabled={isSending} isLoading={isSending} fullWidth className="sm:w-auto">
                {!isSending && <SendIcon className="h-4 w-4" />}
                {isSending ? 'Sending...' : quote.status === 'sent' ? 'Resend quote' : 'Send quote'}
              </AppButton>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-mono text-xl font-semibold tabular-nums text-ink">{quote.quoteNumber}</h2>
              {quote.contactName && (
                <div className="mt-1.5 space-y-0.5">
                  <p className="text-sm text-ink-muted">
                    {quote.contactName}
                    {quote.contactCompany && ` · ${quote.contactCompany}`}
                  </p>
                  {quote.contactEmail && <p className="text-[13px] text-ink-subtle">{quote.contactEmail}</p>}
                </div>
              )}
            </div>
            <StatusSelect
              value={quote.status}
              options={QUOTE_STATUS_OPTIONS}
              onChange={handleStatusChange}
              isLoading={isLoading}
            />
          </div>

          {/* Send error - prominent placement */}
          {sendError && (
            <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
              {sendError}
            </Alert>
          )}

          {/* Client decline note */}
          {quote.status === 'rejected' && quote.clientDeclineReason?.trim() && (
            <div className="rounded-xl border border-warning/30 bg-warning-soft p-4">
              <p className="text-sm font-semibold text-warning">Client decline note</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{quote.clientDeclineReason}</p>
            </div>
          )}

          {/* Line items */}
          <div>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Line items</h3>

            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-xl border border-line sm:block">
              <table className="w-full">
                <thead className="bg-surface-2">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Description</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Qty</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Unit price</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {quote.lineItems.map((item, index) => (
                    <tr key={item.id || index}>
                      <td className="px-4 py-3 text-sm text-ink">{item.description}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-ink">{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-ink">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-medium tabular-nums text-ink">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 sm:hidden">
              {quote.lineItems.map((item, index) => (
                <div key={item.id || index} className="space-y-2 rounded-xl border border-line bg-surface-2 p-4">
                  <div className="text-sm font-medium text-ink">{item.description}</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-muted">Quantity</span>
                    <span className="font-mono tabular-nums text-ink">{item.quantity}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-muted">Unit price</span>
                    <span className="font-mono tabular-nums text-ink">{formatCurrency(item.unitPrice)}</span>
                  </div>
                  <div className="flex justify-between border-t border-line pt-2 text-sm font-medium">
                    <span className="text-ink">Total</span>
                    <span className="font-mono tabular-nums text-ink">{formatCurrency(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">Subtotal</span>
                <span className="font-mono tabular-nums text-ink">{formatCurrency(quote.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Tax ({quote.taxRate * 100}%)</span>
                <span className="font-mono tabular-nums text-ink">{formatCurrency(taxAmount)}</span>
              </div>
              {quote.discount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Discount</span>
                    <span className="font-mono tabular-nums text-ink">-{formatCurrency(quote.discount)}</span>
                  </div>
                  {quote.discountReason && (
                    <p className="text-xs italic text-ink-subtle">{quote.discountReason}</p>
                  )}
                </>
              )}
              <div className="flex items-center justify-between border-t border-line pt-2">
                <span className="text-base font-semibold text-ink">Total</span>
                <span className="font-mono text-base font-bold tabular-nums text-ink">{formatCurrency(quote.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="border-t border-line pt-6">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Notes</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{quote.notes}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="space-y-1 border-t border-line pt-4 text-xs text-ink-subtle">
            <div>
              Created <span className="font-mono tabular-nums">{new Date(quote.createdAt).toLocaleDateString()}</span>
            </div>
            {quote.validUntil && (
              <div>
                Valid until <span className="font-mono tabular-nums">{new Date(quote.validUntil).toLocaleDateString()}</span>
              </div>
            )}
            {quote.updatedAt !== quote.createdAt && (
              <div>
                Updated <span className="font-mono tabular-nums">{new Date(quote.updatedAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Success / status messages */}
          {sendSuccess && lastSentVia && lastSentVia.length > 0 && (
            <Alert tone="success" icon={<CheckIcon className="h-4 w-4" />}>
              Quote sent successfully
              {lastSentVia.includes('email') && lastSentVia.includes('sms')
                ? ` via email and SMS to ${quote.contactEmail || quote.contactPhone || 'contact'}`
                : lastSentVia.includes('sms')
                  ? ` via SMS to ${quote.contactPhone || 'contact'}`
                  : ` via email to ${quote.contactEmail || 'contact'}`}
            </Alert>
          )}
          {sendSuccess && (!lastSentVia || lastSentVia.length === 0) && (
            <Alert tone="warning" icon={<AlertIcon className="h-4 w-4" />}>
              Quote could not be delivered.
              {quote.contactNotificationPreference === 'sms'
                ? ' SMS delivery failed. Check Twilio configuration.'
                : quote.contactNotificationPreference === 'email'
                  ? ' Email delivery failed. Check Resend configuration.'
                  : ' Check Twilio and email configuration.'}
            </Alert>
          )}
          {showConfirmation && (
            <Alert tone="success" icon={<CheckIcon className="h-4 w-4" />}>{confirmationMessage}</Alert>
          )}
          {showJobConfirmation && (
            <Alert tone="success" icon={<CheckIcon className="h-4 w-4" />}>Job has been created</Alert>
          )}
        </div>
      </AppModal>

      {/* Create Job from Quote Modal */}
      <CreateJobFromQuoteModal
        quote={quote}
        isOpen={showCreateJob}
        onClose={() => setShowCreateJob(false)}
        onSuccess={(createdJob) => {
          setShowCreateJob(false)
          setShowJobConfirmation(true)
          onJobCreated?.()
          if (createdJob?.id) {
            onClose()
            navigate(`/app/job-logs/${encodeURIComponent(createdJob.id)}`)
          }
        }}
      />

      {/* Convert to Invoice Modal */}
      <ConvertQuoteToInvoiceModal
        quote={quote}
        isOpen={showConvertModal}
        onClose={() => setShowConvertModal(false)}
        onConvert={handleConvertToInvoice}
        isLoading={isConverting}
      />

      {/* Delete Confirmation Modal */}
      <AppModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete quote"
        size="sm"
        footer={
          <>
            <AppButton variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </AppButton>
            <AppButton variant="danger" onClick={handleDelete} isLoading={isLoading} disabled={isLoading}>
              {isLoading ? 'Deleting...' : 'Delete'}
            </AppButton>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertIcon className="h-5 w-5" />
          </span>
          <p className="text-sm leading-relaxed text-ink-muted">
            Are you sure you want to delete quote{' '}
            <strong className="font-mono text-ink">{quote.quoteNumber}</strong>? This action cannot be undone.
          </p>
        </div>
      </AppModal>
    </>
  )
}

export default QuoteDetail
