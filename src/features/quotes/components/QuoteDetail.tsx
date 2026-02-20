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
    draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    sent: 'bg-primary-blue/30 text-primary-light border-primary-blue/50',
    accepted: 'bg-green-500/20 text-green-400 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    expired: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
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
                disabled={isSending || !quote.contactEmail}
                className="bg-primary-blue hover:bg-primary-blue/90 text-primary-light w-full sm:w-auto py-2 whitespace-nowrap"
                title={!quote.contactEmail ? 'Contact does not have an email address' : undefined}
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
              <h2 className="text-2xl font-bold text-primary-light">{quote.quoteNumber}</h2>
              {quote.contactName && (
                <div className="mt-1">
                  <p className="text-primary-light/70">
                    {quote.contactName}
                    {quote.contactCompany && ` - ${quote.contactCompany}`}
                  </p>
                  {quote.contactEmail && (
                    <p className="text-sm text-primary-light/50 mt-1">{quote.contactEmail}</p>
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
            <h3 className="text-sm font-medium text-primary-light/70 mb-3">Line Items</h3>
            {/* Desktop Table View */}
            <div className="hidden sm:block rounded-lg border border-primary-blue overflow-hidden">
              <table className="w-full">
                <thead className="bg-primary-dark-secondary">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-primary-light">
                      Description
                    </th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-primary-light">
                      Quantity
                    </th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-primary-light">
                      Unit Price
                    </th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-primary-light">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lineItems.map((item, index) => (
                    <tr key={item.id || index} className="border-t border-primary-blue">
                      <td className="px-4 py-3 text-sm text-primary-light">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-primary-light text-right">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-primary-light text-right">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-sm text-primary-light text-right font-medium">
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
                  className="rounded-lg border border-primary-blue bg-primary-dark-secondary p-4 space-y-2"
                >
                  <div className="text-sm font-medium text-primary-light">{item.description}</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-primary-light/70">Quantity:</span>
                    <span className="text-primary-light">{item.quantity}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-primary-light/70">Unit Price:</span>
                    <span className="text-primary-light">{formatCurrency(item.unitPrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium pt-2 border-t border-primary-blue">
                    <span className="text-primary-light">Total:</span>
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
                <span className="text-primary-light/70">Subtotal</span>
                <span className="text-primary-light">{formatCurrency(quote.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-light/70">Tax ({quote.taxRate * 100}%)</span>
                <span className="text-primary-light">{formatCurrency(quote.taxAmount)}</span>
              </div>
              {quote.discount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-primary-light/70">Discount</span>
                    <span className="text-primary-light">-{formatCurrency(quote.discount)}</span>
                  </div>
                  {quote.discountReason && (
                    <div className="text-xs -mt-1 pr-20">
                      <span className="text-primary-light/50 italic pl-2 block">
                        {quote.discountReason}
                      </span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between pt-2 border-t border-primary-blue text-lg font-bold">
                <span className="text-primary-light">Total</span>
                <span className="text-primary-gold">{formatCurrency(quote.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div>
              <h3 className="text-sm font-medium text-primary-light/70 mb-2">Notes</h3>
              <p className="text-sm text-primary-light whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-4 pb-2 border-t border-primary-blue text-xs text-primary-light/50 space-y-1">
            <div>Created: {new Date(quote.createdAt).toLocaleDateString()}</div>
            {quote.validUntil && (
              <div>Valid until: {new Date(quote.validUntil).toLocaleDateString()}</div>
            )}
            {quote.updatedAt !== quote.createdAt && (
              <div>Updated: {new Date(quote.updatedAt).toLocaleDateString()}</div>
            )}
          </div>

          {/* Success/Error Messages - Positioned at Bottom for Mobile Visibility */}
          {sendSuccess && (
            <div className="p-4 rounded-lg border border-green-500 bg-green-500/10">
              <p className="text-sm text-green-400 font-medium">
                ✓ Quote sent successfully to {quote.contactEmail}
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
        <p className="text-primary-light">
          Are you sure you want to delete quote <strong>{quote.quoteNumber}</strong>? This action
          cannot be undone.
        </p>
      </Modal>
    </>
  )
}

export default QuoteDetail
