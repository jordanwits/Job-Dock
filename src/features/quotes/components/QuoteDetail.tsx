import { Quote, QuoteStatus } from '../types/quote'
import { useQuoteStore } from '../store/quoteStore'
import { useInvoiceStore } from '@/features/invoices/store/invoiceStore'
import { Modal, Button, StatusBadgeSelect } from '@/components/ui'
import { useState } from 'react'
import QuoteForm from './QuoteForm'
import ConvertQuoteToInvoiceModal from './ConvertQuoteToInvoiceModal'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { ScheduleJobModal } from '@/features/scheduling'
import { useTheme } from '@/contexts/ThemeContext'

interface QuoteDetailProps {
  quote: Quote
  isOpen: boolean
  onClose: () => void
  onJobCreated?: () => void
  onJobCreateFailed?: (error: string) => void
}

const QuoteDetail = ({
  quote,
  isOpen,
  onClose,
  onJobCreated,
  onJobCreateFailed,
}: QuoteDetailProps) => {
  const { theme } = useTheme()
  const { updateQuote, deleteQuote, sendQuote, isLoading } = useQuoteStore()
  const { convertQuoteToInvoice, setSelectedInvoice, isLoading: isConverting } = useInvoiceStore()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [showScheduleJob, setShowScheduleJob] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const [showJobConfirmation, setShowJobConfirmation] = useState(false)

  const handleUpdate = async (data: any) => {
    try {
      await updateQuote({ id: quote.id, ...data })
      setIsEditing(false)
      setConfirmationMessage('Quote Updated Successfully')
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
      // Update quote status to accepted
      await updateQuote({ id: quote.id, status: 'accepted' })
      setShowConvertModal(false)
      setConfirmationMessage('Quote Converted to Invoice')
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
    setIsSending(true)
    setSendError(null)
    setSendSuccess(false)
    try {
      await sendQuote(quote.id)
      setSendSuccess(true)
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSendSuccess(false)
      }, 3000)
    } catch (error: any) {
      setSendError(error.message || 'Failed to send quote')
      // Hide error message after 5 seconds
      setTimeout(() => {
        setSendError(null)
      }, 5000)
    } finally {
      setIsSending(false)
    }
  }

  const statusColors = {
    draft: theme === 'dark'
      ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      : 'bg-gray-200 text-gray-600 border-gray-300',
    sent: theme === 'dark'
      ? 'bg-primary-blue/20 text-primary-blue border-primary-blue/30'
      : 'bg-blue-100 text-blue-700 border-blue-300',
    accepted: theme === 'dark'
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : 'bg-green-100 text-green-700 border-green-300',
    rejected: theme === 'dark'
      ? 'bg-red-500/20 text-red-400 border-red-500/30'
      : 'bg-red-100 text-red-700 border-red-300',
    expired: theme === 'dark'
      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      : 'bg-orange-100 text-orange-700 border-orange-300',
  }

  const statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'expired', label: 'Expired' },
  ]

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateQuote({ id: quote.id, status: newStatus as QuoteStatus })
    } catch (error) {
      // Error handled by store
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  if (isEditing) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={() => {
          setIsEditing(false)
          onClose()
        }}
        title="Edit Quote"
        size="xl"
      >
        <QuoteForm
          quote={quote}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditing(false)}
          isLoading={isLoading}
        />
      </Modal>
    )
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          quote.contactName && quote.title
            ? `${quote.contactName} ${quote.title}`
            : quote.contactName || quote.title || quote.quoteNumber
        }
        size="lg"
        footer={
          <div className="flex flex-col sm:flex-row justify-between w-full gap-3 py-1">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-500 hover:text-red-600 order-3 sm:order-1 py-2"
            >
              Delete
            </Button>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 order-1 sm:order-2 w-full sm:w-auto">
              <Button
                onClick={() => setShowScheduleJob(true)}
                className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto py-2 whitespace-nowrap"
              >
                Schedule Job
              </Button>
              <Button
                onClick={handleSend}
                disabled={
                  isSending ||
                  !(
                    (['email', 'both'].includes(quote.contactNotificationPreference || 'both') && quote.contactEmail) ||
                    (['sms', 'both'].includes(quote.contactNotificationPreference || 'both') && quote.contactPhone?.trim())
                  )
                }
                className="bg-primary-blue hover:bg-primary-blue/90 text-primary-light w-full sm:w-auto py-2 whitespace-nowrap"
                title={
                  !quote.contactEmail && !quote.contactPhone?.trim()
                    ? 'Contact needs email or phone to receive quote'
                    : (['email', 'both'].includes(quote.contactNotificationPreference || 'both') && !quote.contactEmail)
                      ? 'Contact prefers email but has no email address'
                      : (['sms', 'both'].includes(quote.contactNotificationPreference || 'both') && !quote.contactPhone?.trim())
                        ? 'Contact prefers text but has no phone number'
                        : undefined
                }
              >
                {isSending ? 'Sending...' : quote.status === 'sent' ? 'Resend Quote' : 'Send Quote'}
              </Button>
              {quote.status !== 'rejected' && quote.status !== 'expired' && (
                <Button
                  onClick={() => setShowConvertModal(true)}
                  className="bg-primary-gold hover:bg-primary-gold/90 text-primary-dark w-full sm:w-auto py-2 whitespace-nowrap"
                >
                  Convert to Invoice
                </Button>
              )}
              <Button
                onClick={() => setIsEditing(true)}
                className="w-full sm:w-auto py-2 whitespace-nowrap"
              >
                Edit
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-6 pb-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className={cn(
                "text-2xl font-bold",
                theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
              )}>{quote.quoteNumber}</h2>
              {quote.contactName && (
                <div className="mt-1">
                  <p className={cn(
                    theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                  )}>
                    {quote.contactName}
                    {quote.contactCompany && ` - ${quote.contactCompany}`}
                  </p>
                  {quote.contactEmail && (
                    <p className={cn(
                      "text-sm mt-1",
                      theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary/80'
                    )}>{quote.contactEmail}</p>
                  )}
                </div>
              )}
            </div>
            <StatusBadgeSelect
              value={quote.status}
              options={statusOptions}
              colorClassesByValue={statusColors}
              onChange={handleStatusChange}
              isLoading={isLoading}
              size="md"
            />
          </div>

          {/* Line Items Table */}
          <div>
            <h3 className={cn(
              "text-sm font-medium mb-3",
              theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
            )}>Line Items</h3>
            {/* Desktop Table View */}
            <div className={cn(
              "hidden sm:block rounded-lg border overflow-hidden",
              theme === 'dark' ? 'border-primary-blue' : 'border-gray-200'
            )}>
              <table className="w-full">
                <thead className={theme === 'dark' ? 'bg-primary-dark-secondary' : 'bg-gray-50'}>
                  <tr>
                    <th className={cn(
                      "px-4 py-2 text-left text-sm font-medium",
                      theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                    )}>
                      Description
                    </th>
                    <th className={cn(
                      "px-4 py-2 text-right text-sm font-medium",
                      theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                    )}>
                      Quantity
                    </th>
                    <th className={cn(
                      "px-4 py-2 text-right text-sm font-medium",
                      theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                    )}>
                      Unit Price
                    </th>
                    <th className={cn(
                      "px-4 py-2 text-right text-sm font-medium",
                      theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                    )}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lineItems.map((item, index) => (
                    <tr key={item.id || index} className={cn(
                      "border-t",
                      theme === 'dark' ? 'border-primary-blue' : 'border-gray-200'
                    )}>
                      <td className={cn(
                        "px-4 py-3 text-sm",
                        theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                      )}>{item.description}</td>
                      <td className={cn(
                        "px-4 py-3 text-sm text-right",
                        theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                      )}>
                        {item.quantity}
                      </td>
                      <td className={cn(
                        "px-4 py-3 text-sm text-right",
                        theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                      )}>
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className={cn(
                        "px-4 py-3 text-sm text-right font-medium",
                        theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                      )}>
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {quote.lineItems.map((item, index) => (
                <div
                  key={item.id || index}
                  className={cn(
                    "rounded-lg border p-4 space-y-2",
                    theme === 'dark'
                      ? 'border-primary-blue bg-primary-dark-secondary'
                      : 'border-gray-200 bg-white'
                  )}
                >
                  <div className={cn(
                    "text-sm font-medium",
                    theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                  )}>{item.description}</div>
                  <div className="flex justify-between text-sm">
                    <span className={cn(
                      theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                    )}>Quantity:</span>
                    <span className={cn(
                      theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                    )}>{item.quantity}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={cn(
                      theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                    )}>Unit Price:</span>
                    <span className={cn(
                      theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                    )}>{formatCurrency(item.unitPrice)}</span>
                  </div>
                  <div className={cn(
                    "flex justify-between text-sm font-medium pt-2 border-t",
                    theme === 'dark' ? 'border-primary-blue' : 'border-gray-200'
                  )}>
                    <span className={cn(
                      theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                    )}>Total:</span>
                    <span className="text-primary-gold">{formatCurrency(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full max-w-md space-y-2 text-sm">
              <div className="flex justify-between">
                <span className={cn(
                  theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                )}>Subtotal</span>
                <span className={cn(
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>{formatCurrency(quote.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className={cn(
                  theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                )}>Tax ({quote.taxRate * 100}%)</span>
                <span className={cn(
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>{formatCurrency(quote.taxAmount)}</span>
              </div>
              {quote.discount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className={cn(
                      theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                    )}>Discount</span>
                    <span className={cn(
                      theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                    )}>-{formatCurrency(quote.discount)}</span>
                  </div>
                  {quote.discountReason && (
                    <div className="text-xs -mt-1 pr-20">
                      <span className={cn(
                        "italic pl-2 block",
                        theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary/70'
                      )}>
                        {quote.discountReason}
                      </span>
                    </div>
                  )}
                </>
              )}
              <div className={cn(
                "flex justify-between pt-2 border-t text-lg font-bold",
                theme === 'dark' ? 'border-primary-blue' : 'border-gray-200'
              )}>
                <span className={cn(
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>Total</span>
                <span className="text-primary-gold">{formatCurrency(quote.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div>
              <h3 className={cn(
                "text-sm font-medium mb-2",
                theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
              )}>Notes</h3>
              <p className={cn(
                "text-sm whitespace-pre-wrap",
                theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
              )}>{quote.notes}</p>
            </div>
          )}

          {/* Metadata */}
          <div className={cn(
            "pt-4 pb-2 border-t text-xs space-y-1",
            theme === 'dark'
              ? 'border-primary-blue text-primary-light/50'
              : 'border-gray-200 text-primary-lightTextSecondary'
          )}>
            <div>Created: {new Date(quote.createdAt).toLocaleDateString()}</div>
            {quote.validUntil && (
              <div>Valid until: {new Date(quote.validUntil).toLocaleDateString()}</div>
            )}
            {quote.updatedAt !== quote.createdAt && (
              <div>Updated: {new Date(quote.updatedAt).toLocaleDateString()}</div>
            )}
          </div>

          {/* Success/Error Messages - Positioned at Bottom for Mobile Visibility */}
          {sendSuccess && quote.sentVia && quote.sentVia.length > 0 && (
            <div className="p-4 rounded-lg border border-green-500 bg-green-500/10">
              <p className="text-sm text-green-400 font-medium">
                ✓ Quote sent successfully
                {quote.sentVia.includes('email') && quote.sentVia.includes('sms')
                  ? ` via email and SMS to ${quote.contactEmail || quote.contactPhone || 'contact'}`
                  : quote.sentVia.includes('sms')
                    ? ` via SMS to ${quote.contactPhone || 'contact'}`
                    : ` via email to ${quote.contactEmail || 'contact'}`}
              </p>
            </div>
          )}
          {sendSuccess && (!quote.sentVia || quote.sentVia.length === 0) && (
            <div className="p-4 rounded-lg border border-amber-500 bg-amber-500/10">
              <p className="text-sm text-amber-400 font-medium">
                Quote could not be delivered.
                {quote.contactNotificationPreference === 'sms'
                  ? ' SMS delivery failed. Check Twilio configuration.'
                  : quote.contactNotificationPreference === 'email'
                    ? ' Email delivery failed. Check Resend configuration.'
                    : ' Check Twilio and email configuration.'}
              </p>
            </div>
          )}
          {sendError && (
            <div className="p-4 rounded-lg border border-red-500 bg-red-500/10">
              <p className="text-sm text-red-400 font-medium">✗ {sendError}</p>
            </div>
          )}
          {showConfirmation && (
            <div className="p-4 rounded-lg border border-green-500 bg-green-500/10">
              <p className="text-sm text-green-400 font-medium">✓ {confirmationMessage}</p>
            </div>
          )}
          {showJobConfirmation && (
            <div className="p-4 rounded-lg border border-green-500 bg-green-500/10">
              <p className="text-sm text-green-400 font-medium">✓ Job has been created</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Schedule Job Modal */}
      <ScheduleJobModal
        isOpen={showScheduleJob}
        onClose={() => setShowScheduleJob(false)}
        defaultContactId={quote.contactId}
        defaultTitle={(() => {
          const title = quote.title || `Job for quote ${quote.quoteNumber}`
          if (quote.contactName) {
            const nameParts = quote.contactName.trim().split(/\s+/)
            const lastName = nameParts.length > 0 ? nameParts[nameParts.length - 1] : quote.contactName
            return lastName ? `${lastName}-${title}` : title
          }
          return title
        })()}
        defaultPrice={quote.total}
        sourceContext="quote"
        quoteId={quote.id}
        initialQuoteId={quote.id}
        onSuccess={(createdJob) => {
          setShowScheduleJob(false)
          onClose()
          if (onJobCreated) {
            onJobCreated()
          }
          if (createdJob?.id) {
            navigate(`/app/scheduling?tab=calendar&jobId=${encodeURIComponent(createdJob.id)}`)
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
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Quote"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-red-500 hover:bg-red-600"
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className={cn(
          theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
        )}>
          Are you sure you want to delete quote <strong>{quote.quoteNumber}</strong>? This action
          cannot be undone.
        </p>
      </Modal>
    </>
  )
}

export default QuoteDetail
