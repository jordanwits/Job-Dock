import { Invoice } from '../types/invoice'
import { useInvoiceStore } from '../store/invoiceStore'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'

interface InvoiceCardProps {
  invoice: Invoice
  isSelected?: boolean
  onToggleSelect?: (id: string, event: React.MouseEvent) => void
}

const InvoiceCard = ({ invoice, isSelected, onToggleSelect }: InvoiceCardProps) => {
  const { setSelectedInvoice } = useInvoiceStore()

  const statusColors = {
    draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    sent: 'bg-primary-blue/20 text-primary-blue border-primary-blue/30',
    overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
    cancelled: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  }

  const paymentStatusColors = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    partial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    paid: 'bg-green-500/20 text-green-400 border-green-500/30',
  }

  const paymentStatusLabels = {
    pending: 'Unpaid',
    partial: 'Partial',
    paid: 'Paid',
  }

  const approvalStatusColors = {
    none: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    accepted: 'bg-green-500/20 text-green-400 border-green-500/30',
    declined: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  
  // Only show status badge if it's not redundant with paymentStatus
  // Show status for: draft, overdue, cancelled
  // Hide status for: sent (since paymentStatus already shows pending/partial/paid)
  const shouldShowStatus = invoice.status === 'draft' || invoice.status === 'overdue' || invoice.status === 'cancelled'

  // Show approval status for sent invoices
  const shouldShowApproval = invoice.status === 'sent' && invoice.approvalStatus && invoice.approvalStatus !== 'none'

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  // Invoice is overdue if due date is more than 1 day in the past
  // (not on the due date itself, but the day after)
  const isOverdue = invoice.dueDate && invoice.paymentStatus !== 'paid' && (() => {
    const dueDate = new Date(invoice.dueDate)
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)
    oneDayAgo.setHours(23, 59, 59, 999)
    return dueDate < oneDayAgo
  })()

  return (
    <Card
      className={cn(
        "cursor-pointer hover:border-primary-gold transition-colors relative",
        isSelected && "ring-2 ring-primary-gold"
      )}
      onClick={() => setSelectedInvoice(invoice)}
    >
      <div className="space-y-3">
        {/* Selection Checkbox */}
        {onToggleSelect && (
          <div 
            className="absolute top-3 left-3 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isSelected || false}
              onChange={(e) => onToggleSelect(invoice.id, e as any)}
              className="w-5 h-5 rounded border-primary-light/20 bg-primary-dark cursor-pointer"
            />
          </div>
        )}
        
        {/* Header */}
        <div className={cn("flex items-start justify-between", onToggleSelect && "pl-8")}>
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="text-lg font-semibold text-primary-light">
              {invoice.invoiceNumber}
              {invoice.contactName && invoice.title && (
                <span className="text-primary-light/90"> — {invoice.contactName} {invoice.title}</span>
              )}
            </h3>
            {invoice.contactCompany && (
              <p className="text-xs text-primary-light/50 mt-1">{invoice.contactCompany}</p>
            )}
          </div>
          <div className="flex flex-col gap-1 items-end">
            {shouldShowStatus && (
              <span
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded border',
                  statusColors[invoice.status]
                )}
              >
                {invoice.status}
              </span>
            )}
            {shouldShowApproval && (
              <span
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded border',
                  approvalStatusColors[invoice.approvalStatus!]
                )}
              >
                Client {invoice.approvalStatus}
              </span>
            )}
            <span
              className={cn(
                'px-2 py-1 text-xs font-medium rounded border',
                paymentStatusColors[invoice.paymentStatus]
              )}
            >
              {paymentStatusLabels[invoice.paymentStatus]}
            </span>
          </div>
        </div>

        {/* Line Items Count */}
        <div className="text-sm text-primary-light/70">
          {invoice.lineItems.length} item{invoice.lineItems.length !== 1 ? 's' : ''}
        </div>

        {/* Payment Info */}
        {invoice.paymentStatus === 'partial' && (
          <div className="text-sm text-primary-light/70">
            Paid: {formatCurrency(invoice.paidAmount)} / {formatCurrency(invoice.total)}
          </div>
        )}

        {/* Total */}
        <div className="pt-2 border-t border-primary-blue">
          <div className="flex justify-between items-center">
            <span className="text-sm text-primary-light/70">Total</span>
            <span className="text-xl font-bold text-primary-gold">
              {formatCurrency(invoice.total)}
            </span>
          </div>
        </div>

        {/* Due Date */}
        {invoice.dueDate && (
          <div className={cn(
            "text-xs",
            isOverdue ? "text-red-400 font-medium" : "text-primary-light/50"
          )}>
            {isOverdue ? '⚠️ ' : ''}Due: {new Date(invoice.dueDate).toLocaleDateString()}
          </div>
        )}
      </div>
    </Card>
  )
}

export default InvoiceCard

