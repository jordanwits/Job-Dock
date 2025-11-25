import { Invoice } from '../types/invoice'
import { useInvoiceStore } from '../store/invoiceStore'
import { Modal, Button } from '@/components/ui'
import { useState } from 'react'
import InvoiceForm from './InvoiceForm'
import { cn } from '@/lib/utils'

interface InvoiceDetailProps {
  invoice: Invoice
  isOpen: boolean
  onClose: () => void
}

const InvoiceDetail = ({ invoice, isOpen, onClose }: InvoiceDetailProps) => {
  const { updateInvoice, deleteInvoice, isLoading } = useInvoiceStore()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleUpdate = async (data: any) => {
    try {
      await updateInvoice({ id: invoice.id, ...data })
      setIsEditing(false)
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

  const statusColors = {
    draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    sent: 'bg-primary-blue/20 text-primary-blue border-primary-blue/30',
    overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
    cancelled: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  }
  
  // Only show status badge if it's not redundant with paymentStatus
  const shouldShowStatus = invoice.status === 'draft' || invoice.status === 'overdue' || invoice.status === 'cancelled'

  const paymentStatusColors = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    partial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    paid: 'bg-green-500/20 text-green-400 border-green-500/30',
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const isOverdue = invoice.dueDate && 
    new Date(invoice.dueDate) < new Date() && 
    invoice.paymentStatus !== 'paid'

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
          <div className="flex justify-between w-full">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-500 hover:text-red-600"
            >
              Delete
            </Button>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button onClick={() => setIsEditing(true)}>Edit</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-primary-light">
                {invoice.invoiceNumber}
              </h2>
              {invoice.contactName && (
                <p className="text-primary-light/70 mt-1">
                  {invoice.contactName}
                  {invoice.contactCompany && ` - ${invoice.contactCompany}`}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 items-end">
              {shouldShowStatus && (
                <span
                  className={cn(
                    'px-3 py-1 text-sm font-medium rounded border',
                    statusColors[invoice.status]
                  )}
                >
                  {invoice.status}
                </span>
              )}
              <span
                className={cn(
                  'px-3 py-1 text-sm font-medium rounded border',
                  paymentStatusColors[invoice.paymentStatus]
                )}
              >
                {invoice.paymentStatus}
              </span>
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
              <p className="text-sm text-red-400 font-medium">
                ⚠️ This invoice is overdue
              </p>
              <p className="text-xs text-red-400/70 mt-1">
                Due date: {new Date(invoice.dueDate!).toLocaleDateString()}
              </p>
            </div>
          )}

          {/* Line Items Table */}
          <div>
            <h3 className="text-sm font-medium text-primary-light/70 mb-3">
              Line Items
            </h3>
            <div className="rounded-lg border border-primary-blue overflow-hidden">
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
                    <tr
                      key={item.id || index}
                      className="border-t border-primary-blue"
                    >
                      <td className="px-4 py-3 text-sm text-primary-light">
                        {item.description}
                      </td>
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
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full max-w-md space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-primary-light/70">Subtotal</span>
                <span className="text-primary-light">
                  {formatCurrency(invoice.subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-light/70">
                  Tax ({invoice.taxRate * 100}%)
                </span>
                <span className="text-primary-light">
                  {formatCurrency(invoice.taxAmount)}
                </span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-primary-light/70">Discount</span>
                  <span className="text-primary-light">
                    -{formatCurrency(invoice.discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-primary-blue text-lg font-bold">
                <span className="text-primary-light">Total</span>
                <span className="text-primary-gold">
                  {formatCurrency(invoice.total)}
                </span>
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
                  <p className={cn(
                    "text-sm mt-1",
                    isOverdue ? "text-red-400 font-medium" : "text-primary-light"
                  )}>
                    {new Date(invoice.dueDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div>
              <h3 className="text-sm font-medium text-primary-light/70 mb-2">
                Notes
              </h3>
              <p className="text-sm text-primary-light whitespace-pre-wrap">
                {invoice.notes}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-4 border-t border-primary-blue text-xs text-primary-light/50 space-y-1">
            <div>Created: {new Date(invoice.createdAt).toLocaleDateString()}</div>
            {invoice.updatedAt !== invoice.createdAt && (
              <div>Updated: {new Date(invoice.updatedAt).toLocaleDateString()}</div>
            )}
          </div>
        </div>
      </Modal>

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
          Are you sure you want to delete invoice <strong>{invoice.invoiceNumber}</strong>?
          This action cannot be undone.
        </p>
      </Modal>
    </>
  )
}

export default InvoiceDetail

