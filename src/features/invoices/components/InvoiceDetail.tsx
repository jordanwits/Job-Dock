import { Invoice, InvoiceStatus, PaymentStatus, ApprovalStatus } from '../types/invoice'
import { useInvoiceStore } from '../store/invoiceStore'
import { Modal, Button, StatusBadgeSelect } from '@/components/ui'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import InvoiceForm from './InvoiceForm'
import { cn } from '@/lib/utils'
import { ScheduleJobModal } from '@/features/scheduling'
import { useTheme } from '@/contexts/ThemeContext'

interface InvoiceDetailProps {
  invoice: Invoice
  isOpen: boolean
  onClose: () => void
  onJobCreated?: () => void
  onJobCreateFailed?: (error: string) => void
}

const InvoiceDetail = ({
  invoice,
  isOpen,
  onClose,
  onJobCreated,
  onJobCreateFailed,
}: InvoiceDetailProps) => {
  const { theme } = useTheme()
  const { updateInvoice, deleteInvoice, sendInvoice, isLoading } = useInvoiceStore()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showScheduleJob, setShowScheduleJob] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const [showJobConfirmation, setShowJobConfirmation] = useState(false)

  const handleUpdate = async (data: any) => {
    try {
      await updateInvoice({ id: invoice.id, ...data })
      setIsEditing(false)
      setConfirmationMessage('Invoice Updated Successfully')
      setShowConfirmation(true)
      setTimeout(() => setShowConfirmation(false), 3000)
    } catch (error) {
      // Error handled by store
    }
  }

  const handleDelete = async () => {
    try {
      await deleteInvoice(invoice.id)
      setShowDeleteConfirm(false)
      onClose()
    } catch (error) {
      // Error handled by store
    }
  }

  const handleSend = async () => {
    setIsSending(true)
    setSendError(null)
    setSendSuccess(false)
    try {
      await sendInvoice(invoice.id)
      setSendSuccess(true)
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSendSuccess(false)
      }, 3000)
    } catch (error: any) {
      setSendError(error.message || 'Failed to send invoice')
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
    overdue: theme === 'dark'
      ? 'bg-red-500/20 text-red-400 border-red-500/30'
      : 'bg-red-100 text-red-700 border-red-300',
    cancelled: theme === 'dark'
      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      : 'bg-orange-100 text-orange-700 border-orange-300',
  }

  // Only show status badge if it's not redundant with paymentStatus
  const shouldShowStatus =
    invoice.status === 'draft' || invoice.status === 'overdue' || invoice.status === 'cancelled'

  const paymentStatusColors = {
    pending: theme === 'dark'
      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      : 'bg-yellow-100 text-yellow-700 border-yellow-300',
    partial: theme === 'dark'
      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      : 'bg-blue-100 text-blue-700 border-blue-300',
    paid: theme === 'dark'
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : 'bg-green-100 text-green-700 border-green-300',
  }

  const approvalStatusColors = {
    none: theme === 'dark'
      ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      : 'bg-gray-200 text-gray-600 border-gray-300',
    accepted: theme === 'dark'
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : 'bg-green-100 text-green-700 border-green-300',
    declined: theme === 'dark'
      ? 'bg-red-500/20 text-red-400 border-red-500/30'
      : 'bg-red-100 text-red-700 border-red-300',
  }

  const invoiceStatusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  const paymentStatusOptions = [
    { value: 'pending', label: 'Unpaid' },
    { value: 'partial', label: 'Partial' },
    { value: 'paid', label: 'Paid' },
  ]

  const approvalStatusOptions = [
    { value: 'none', label: 'No Response' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'declined', label: 'Declined' },
  ]

  const handleInvoiceStatusChange = async (newStatus: string) => {
    try {
      await updateInvoice({ id: invoice.id, status: newStatus as InvoiceStatus })
    } catch (error) {
      // Error handled by store
    }
  }

  const handlePaymentStatusChange = async (newPaymentStatus: string) => {
    try {
      await updateInvoice({ id: invoice.id, paymentStatus: newPaymentStatus as PaymentStatus })
    } catch (error) {
      // Error handled by store
    }
  }

  const handleApprovalStatusChange = async (newApprovalStatus: string) => {
    try {
      await updateInvoice({ id: invoice.id, approvalStatus: newApprovalStatus as ApprovalStatus })
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

  // Invoice is overdue if due date is more than 1 day in the past
  // (not on the due date itself, but the day after)
  const isOverdue =
    invoice.dueDate &&
    invoice.paymentStatus !== 'paid' &&
    (() => {
      const dueDate = new Date(invoice.dueDate)
      const oneDayAgo = new Date()
      oneDayAgo.setDate(oneDayAgo.getDate() - 1)
      oneDayAgo.setHours(23, 59, 59, 999)
      return dueDate < oneDayAgo
    })()

  if (isEditing) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={() => {
          setIsEditing(false)
          onClose()
        }}
        title="Edit Invoice"
        size="xl"
      >
        <InvoiceForm
          invoice={invoice}
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
          invoice.contactName && invoice.title
            ? `${invoice.contactName} ${invoice.title}`
            : invoice.contactName || invoice.title || invoice.invoiceNumber
        }
        size="lg"
        footer={
          <div className="flex flex-col sm:flex-row justify-between w-full gap-3">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-500 hover:text-red-600 order-3 sm:order-1"
            >
              Delete
            </Button>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 order-1 sm:order-2 w-full sm:w-auto">
              <Button
                onClick={() => setShowScheduleJob(true)}
                className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto whitespace-nowrap"
              >
                Schedule Job
              </Button>
              <Button
                onClick={handleSend}
                disabled={isSending || !invoice.contactEmail}
                className="bg-primary-blue hover:bg-primary-blue/90 text-primary-light w-full sm:w-auto whitespace-nowrap"
                title={!invoice.contactEmail ? 'Contact does not have an email address' : undefined}
              >
                {isSending
                  ? 'Sending...'
                  : invoice.status === 'sent'
                    ? 'Resend Invoice'
                    : 'Send Invoice'}
              </Button>
              <Button
                onClick={() => setIsEditing(true)}
                className="w-full sm:w-auto whitespace-nowrap"
              >
                Edit
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className={cn(
                "text-2xl font-bold break-words",
                theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
              )}>{invoice.invoiceNumber}</h2>
              {invoice.contactName && (
                <div className="mt-1">
                  <p className={cn(
                    "break-words",
                    theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                  )}>
                    {invoice.contactName}
                    {invoice.contactCompany && ` - ${invoice.contactCompany}`}
                  </p>
                  {invoice.contactEmail && (
                    <p className={cn(
                      "text-sm mt-1 break-words",
                      theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary/80'
                    )}>{invoice.contactEmail}</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 items-start sm:items-end flex-shrink-0">
              {shouldShowStatus && (
                <StatusBadgeSelect
                  value={invoice.status}
                  options={invoiceStatusOptions}
                  colorClassesByValue={statusColors}
                  onChange={handleInvoiceStatusChange}
                  isLoading={isLoading}
                  size="md"
                />
              )}
              {invoice.trackResponse !== false && invoice.approvalStatus && (
                <StatusBadgeSelect
                  value={invoice.approvalStatus}
                  options={approvalStatusOptions}
                  colorClassesByValue={approvalStatusColors}
                  onChange={handleApprovalStatusChange}
                  isLoading={isLoading}
                  size="md"
                />
              )}
              {invoice.trackPayment !== false && (
                <StatusBadgeSelect
                  value={invoice.paymentStatus}
                  options={paymentStatusOptions}
                  colorClassesByValue={paymentStatusColors}
                  onChange={handlePaymentStatusChange}
                  isLoading={isLoading}
                  size="md"
                />
              )}
            </div>
          </div>

          {/* Payment Info */}
          {invoice.trackPayment !== false && invoice.paymentStatus === 'partial' && (
            <div className={cn(
              "p-4 rounded-lg border",
              theme === 'dark'
                ? 'border-primary-blue bg-primary-dark-secondary'
                : 'border-gray-200 bg-white'
            )}>
              <div className="flex justify-between items-center">
                <span className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                )}>Amount Paid</span>
                <span className={cn(
                  "text-lg font-semibold",
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>
                  {formatCurrency(invoice.paidAmount)}
                </span>
              </div>
              <div className={cn(
                "flex justify-between items-center mt-2 pt-2 border-t",
                theme === 'dark' ? 'border-primary-blue' : 'border-gray-200'
              )}>
                <span className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                )}>Remaining Balance</span>
                <span className="text-lg font-bold text-primary-gold">
                  {formatCurrency(invoice.total - invoice.paidAmount)}
                </span>
              </div>
            </div>
          )}

          {/* Due Date Warning */}
          {isOverdue && (
            <div className="p-4 rounded-lg border border-red-500 bg-red-500/10">
              <p className="text-sm text-red-400 font-medium">⚠️ This invoice is overdue</p>
              <p className="text-xs text-red-400/70 mt-1">
                Due date: {new Date(invoice.dueDate!).toLocaleDateString()}
              </p>
            </div>
          )}

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
                  {invoice.lineItems.map((item, index) => (
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
              {invoice.lineItems.map((item, index) => (
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
                )}>{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className={cn(
                  theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                )}>Tax ({invoice.taxRate * 100}%)</span>
                <span className={cn(
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>{formatCurrency(invoice.taxAmount)}</span>
              </div>
              {invoice.discount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className={cn(
                      theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                    )}>Discount</span>
                    <span className={cn(
                      theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                    )}>-{formatCurrency(invoice.discount)}</span>
                  </div>
                  {invoice.discountReason && (
                    <div className="text-xs -mt-1 pr-20">
                      <span className={cn(
                        "italic pl-2 block",
                        theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary/70'
                      )}>
                        {invoice.discountReason}
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
                <span className="text-primary-gold">{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Terms and Due Date */}
          {(invoice.paymentTerms || invoice.dueDate) && (
            <div className={cn(
              "grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border",
              theme === 'dark'
                ? 'border-primary-blue bg-primary-dark-secondary'
                : 'border-gray-200 bg-white'
            )}>
              {invoice.paymentTerms && (
                <div>
                  <span className={cn(
                    "text-xs",
                    theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary/70'
                  )}>Payment Terms</span>
                  <p className={cn(
                    "text-sm mt-1",
                    theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                  )}>{invoice.paymentTerms}</p>
                </div>
              )}
              {invoice.dueDate && (
                <div>
                  <span className={cn(
                    "text-xs",
                    theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary/70'
                  )}>Due Date</span>
                  <p
                    className={cn(
                      'text-sm mt-1',
                      isOverdue ? 'text-red-400 font-medium' : theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                    )}
                  >
                    {new Date(invoice.dueDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div>
              <h3 className={cn(
                "text-sm font-medium mb-2",
                theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
              )}>Notes</h3>
              <p className={cn(
                "text-sm whitespace-pre-wrap",
                theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
              )}>{invoice.notes}</p>
            </div>
          )}

          {/* Metadata */}
          <div className={cn(
            "pt-4 border-t text-xs space-y-1",
            theme === 'dark'
              ? 'border-primary-blue text-primary-light/50'
              : 'border-gray-200 text-primary-lightTextSecondary'
          )}>
            <div>Created: {new Date(invoice.createdAt).toLocaleDateString()}</div>
            {invoice.updatedAt !== invoice.createdAt && (
              <div>Updated: {new Date(invoice.updatedAt).toLocaleDateString()}</div>
            )}
          </div>

          {/* Success/Error Messages - Positioned at Bottom for Mobile Visibility */}
          {sendSuccess && (
            <div className="p-4 rounded-lg border border-green-500 bg-green-500/10">
              <p className="text-sm text-green-400 font-medium">
                ✓ Invoice sent successfully to {invoice.contactEmail}
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
        defaultContactId={invoice.contactId}
        defaultTitle={(() => {
          const title = invoice.title || `Job for invoice ${invoice.invoiceNumber}`
          if (invoice.contactName) {
            const nameParts = invoice.contactName.trim().split(/\s+/)
            const lastName = nameParts.length > 0 ? nameParts[nameParts.length - 1] : invoice.contactName
            return lastName ? `${lastName}-${title}` : title
          }
          return title
        })()}
        defaultPrice={invoice.total}
        sourceContext="invoice"
        invoiceId={invoice.id}
        initialInvoiceId={invoice.id}
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Invoice"
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
          Are you sure you want to delete invoice <strong>{invoice.invoiceNumber}</strong>? This
          action cannot be undone.
        </p>
      </Modal>
    </>
  )
}

export default InvoiceDetail
