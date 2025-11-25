import { Quote } from '../types/quote'
import { useQuoteStore } from '../store/quoteStore'
import { useInvoiceStore } from '@/features/invoices/store/invoiceStore'
import { Modal, Button } from '@/components/ui'
import { useState } from 'react'
import QuoteForm from './QuoteForm'
import ConvertQuoteToInvoiceModal from './ConvertQuoteToInvoiceModal'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'

interface QuoteDetailProps {
  quote: Quote
  isOpen: boolean
  onClose: () => void
}

const QuoteDetail = ({ quote, isOpen, onClose }: QuoteDetailProps) => {
  const { updateQuote, deleteQuote, isLoading } = useQuoteStore()
  const { convertQuoteToInvoice, isLoading: isConverting } = useInvoiceStore()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)

  const handleUpdate = async (data: any) => {
    try {
      await updateQuote({ id: quote.id, ...data })
      setIsEditing(false)
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
      onClose()
      // Navigate to the new invoice
      navigate(`/invoices`)
      // Optionally select the new invoice
      setTimeout(() => {
        // The invoice will be in the list, user can find it
      }, 100)
    } catch (error) {
      // Error handled by store
    }
  }

  const statusColors = {
    draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    sent: 'bg-primary-blue/30 text-primary-light border-primary-blue/50',
    accepted: 'bg-green-500/20 text-green-400 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    expired: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
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
        title={quote.quoteNumber}
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
              {quote.status !== 'rejected' && quote.status !== 'expired' && (
                <Button
                  onClick={() => setShowConvertModal(true)}
                  className="bg-primary-gold hover:bg-primary-gold/90 text-primary-dark w-full sm:w-auto"
                >
                  Convert to Invoice
                </Button>
              )}
              <Button onClick={() => setIsEditing(true)} className="w-full sm:w-auto">
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
              <h2 className="text-2xl font-bold text-primary-light">
                {quote.quoteNumber}
              </h2>
              {quote.contactName && (
                <p className="text-primary-light/70 mt-1">
                  {quote.contactName}
                  {quote.contactCompany && ` - ${quote.contactCompany}`}
                </p>
              )}
            </div>
            <span
              className={cn(
                'px-3 py-1 text-sm font-medium rounded border',
                statusColors[quote.status]
              )}
            >
              {quote.status}
            </span>
          </div>

          {/* Line Items Table */}
          <div>
            <h3 className="text-sm font-medium text-primary-light/70 mb-3">
              Line Items
            </h3>
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
            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {quote.lineItems.map((item, index) => (
                <div
                  key={item.id || index}
                  className="rounded-lg border border-primary-blue bg-primary-dark-secondary p-4 space-y-2"
                >
                  <div className="text-sm font-medium text-primary-light">
                    {item.description}
                  </div>
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
                <span className="text-primary-light">
                  {formatCurrency(quote.subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-light/70">
                  Tax ({quote.taxRate * 100}%)
                </span>
                <span className="text-primary-light">
                  {formatCurrency(quote.taxAmount)}
                </span>
              </div>
              {quote.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-primary-light/70">Discount</span>
                  <span className="text-primary-light">
                    -{formatCurrency(quote.discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-primary-blue text-lg font-bold">
                <span className="text-primary-light">Total</span>
                <span className="text-primary-gold">
                  {formatCurrency(quote.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div>
              <h3 className="text-sm font-medium text-primary-light/70 mb-2">
                Notes
              </h3>
              <p className="text-sm text-primary-light whitespace-pre-wrap">
                {quote.notes}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-4 border-t border-primary-blue text-xs text-primary-light/50 space-y-1">
            <div>Created: {new Date(quote.createdAt).toLocaleDateString()}</div>
            {quote.validUntil && (
              <div>
                Valid until: {new Date(quote.validUntil).toLocaleDateString()}
              </div>
            )}
            {quote.updatedAt !== quote.createdAt && (
              <div>Updated: {new Date(quote.updatedAt).toLocaleDateString()}</div>
            )}
          </div>
        </div>
      </Modal>

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
          Are you sure you want to delete quote <strong>{quote.quoteNumber}</strong>?
          This action cannot be undone.
        </p>
      </Modal>
    </>
  )
}

export default QuoteDetail

