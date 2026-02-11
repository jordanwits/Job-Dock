import { Invoice, InvoiceStatus, PaymentStatus, ApprovalStatus } from '../types/invoice'
import { useInvoiceStore } from '../store/invoiceStore'
import { Modal, Button, StatusBadgeSelect } from '@/components/ui'
import { useState } from 'react'
import InvoiceForm from './InvoiceForm'
import { cn } from '@/lib/utils'
import { ScheduleJobModal } from '@/features/scheduling'

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
  const { updateInvoice, deleteInvoice, sendInvoice, isLoading } = useInvoiceStore()
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
    draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    sent: 'bg-primary-blue/20 text-primary-blue border-primary-blue/30',
    overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
    cancelled: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  }

  // Only show status badge if it's not redundant with paymentStatus
  const shouldShowStatus =
    invoice.status === 'draft' || invoice.status === 'overdue' || invoice.status === 'cancelled'

  const paymentStatusColors = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    partial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    paid: 'bg-green-500/20 text-green-400 border-green-500/30',
  }

  const approvalStatusColors = {
    none: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    accepted: 'bg-green-500/20 text-green-400 border-green-500/30',
    declined: 'bg-red-500/20 text-red-400 border-red-500/30',
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
        title={invoice.invoiceNumber}
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-primary-light">{invoice.invoiceNumber}</h2>
              {invoice.contactName && (
                <p className="text-primary-light/70 mt-1">
                  {invoice.contactName}
                  {invoice.contactCompany && ` - ${invoice.contactCompany}`}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 items-end">
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
              {invoice.approvalStatus && (
                <StatusBadgeSelect
                  value={invoice.approvalStatus}
                  options={approvalStatusOptions}
                  colorClassesByValue={approvalStatusColors}
                  onChange={handleApprovalStatusChange}
                  isLoading={isLoading}
                  size="md"
                />
              )}
              <StatusBadgeSelect
                value={invoice.paymentStatus}
                options={paymentStatusOptions}
                colorClassesByValue={paymentStatusColors}
                onChange={handlePaymentStatusChange}
                isLoading={isLoading}
                size="md"
              />
            </div>
          </div>

          {/* Payment Info */}
          {invoice.paymentStatus === 'partial' && (
            <div className="p-4 rounded-lg border border-primary-blue bg-primary-dark-secondary">
              <div className="flex justify-between items-center">
                <span className="text-sm text-primary-light/70">Amount Paid</span>
                <span className="text-lg font-semibold text-primary-light">
                  {formatCurrency(invoice.paidAmount)}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-primary-blue">
                <span className="text-sm text-primary-light/70">Remaining Balance</span>
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
                  {invoice.lineItems.map((item, index) => (
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
              {invoice.lineItems.map((item, index) => (
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
                <span className="text-primary-light">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-light/70">Tax ({invoice.taxRate * 100}%)</span>
                <span className="text-primary-light">{formatCurrency(invoice.taxAmount)}</span>
              </div>
              {invoice.discount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-primary-light/70">Discount</span>
                    <span className="text-primary-light">-{formatCurrency(invoice.discount)}</span>
                  </div>
                  {invoice.discountReason && (
                    <div className="text-xs -mt-1 pr-20">
                      <span className="text-primary-light/50 italic pl-2 block">
                        {invoice.discountReason}
                      </span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between pt-2 border-t border-primary-blue text-lg font-bold">
                <span className="text-primary-light">Total</span>
                <span className="text-primary-gold">{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Terms and Due Date */}
          {(invoice.paymentTerms || invoice.dueDate) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border border-primary-blue bg-primary-dark-secondary">
              {invoice.paymentTerms && (
                <div>
                  <span className="text-xs text-primary-light/50">Payment Terms</span>
                  <p className="text-sm text-primary-light mt-1">{invoice.paymentTerms}</p>
                </div>
              )}
              {invoice.dueDate && (
                <div>
                  <span className="text-xs text-primary-light/50">Due Date</span>
                  <p
                    className={cn(
                      'text-sm mt-1',
                      isOverdue ? 'text-red-400 font-medium' : 'text-primary-light'
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
              <h3 className="text-sm font-medium text-primary-light/70 mb-2">Notes</h3>
              <p className="text-sm text-primary-light whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-4 border-t border-primary-blue text-xs text-primary-light/50 space-y-1">
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
        defaultTitle={`Job for invoice ${invoice.invoiceNumber}`}
        sourceContext="invoice"
        invoiceId={invoice.id}
        initialInvoiceId={invoice.id}
        onSuccess={() => {
          setShowScheduleJob(false)
          onClose()
          if (onJobCreated) {
            onJobCreated()
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
        <p className="text-primary-light">
          Are you sure you want to delete invoice <strong>{invoice.invoiceNumber}</strong>? This
          action cannot be undone.
        </p>
      </Modal>
    </>
  )
}

export default InvoiceDetail
