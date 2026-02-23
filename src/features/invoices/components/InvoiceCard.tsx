import { Invoice } from '../types/invoice'
import { useInvoiceStore } from '../store/invoiceStore'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

interface InvoiceCardProps {
  invoice: Invoice
  isSelected?: boolean
  onToggleSelect?: (id: string, event: React.MouseEvent) => void
}

const InvoiceCard = ({ invoice, isSelected, onToggleSelect }: InvoiceCardProps) => {
  const { theme } = useTheme()
  const { setSelectedInvoice } = useInvoiceStore()

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

  const paymentStatusLabels = {
    pending: 'Unpaid',
    partial: 'Partial',
    paid: 'Paid',
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

  // Only show status badge if it's not redundant with paymentStatus
  // Show status for: draft, overdue, cancelled
  // Hide status for: sent (since paymentStatus already shows pending/partial/paid)
  const shouldShowStatus =
    invoice.status === 'draft' || invoice.status === 'overdue' || invoice.status === 'cancelled'

  // Show approval status for sent invoices only if trackResponse is enabled
  const shouldShowApproval =
    invoice.trackResponse !== false &&
    invoice.status === 'sent' &&
    invoice.approvalStatus &&
    invoice.approvalStatus !== 'none'

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

  return (
    <Card
      className={cn(
        'cursor-pointer hover:border-primary-gold transition-colors relative',
        isSelected && 'ring-2 ring-primary-gold'
      )}
      onClick={() => setSelectedInvoice(invoice)}
    >
      <div className="space-y-3">
        {/* Selection Bullet Point */}
        {onToggleSelect && (
          <div
            className="absolute top-3 left-3 z-10"
            onClick={e => {
              e.stopPropagation()
              onToggleSelect(invoice.id, e)
            }}
          >
            <div
              className={cn(
                'w-5 h-5 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center',
                isSelected
                  ? 'bg-primary-gold border-primary-gold shadow-lg shadow-primary-gold/50'
                  : theme === 'dark'
                    ? 'border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10'
                    : 'border-gray-400 bg-white hover:border-primary-gold/50 hover:bg-primary-gold/10'
              )}
            >
              {isSelected && <div className={cn(
                "w-2.5 h-2.5 rounded-full",
                theme === 'dark' ? 'bg-primary-dark' : 'bg-white'
              )} />}
            </div>
          </div>
        )}

        {/* Header */}
        <div className={cn('flex items-start justify-between', onToggleSelect && 'pl-8')}>
          <div className="flex-1 min-w-0 pr-2">
            <h3 className={cn(
              "text-lg font-semibold",
              theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
            )}>
              {invoice.invoiceNumber}
              {invoice.contactName && invoice.title && (
                <span className={cn(
                  theme === 'dark' ? 'text-primary-light/90' : 'text-primary-lightText/90'
                )}>
                  {' '}
                  — {invoice.contactName} {invoice.title}
                </span>
              )}
            </h3>
            {invoice.contactCompany && (
              <p className={cn(
                "text-xs mt-1",
                theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
              )}>{invoice.contactCompany}</p>
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
            {invoice.trackPayment !== false && (
              <span
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded border',
                  paymentStatusColors[invoice.paymentStatus]
                )}
              >
                {paymentStatusLabels[invoice.paymentStatus]}
              </span>
            )}
          </div>
        </div>

        {/* Line Items Count */}
        <div className={cn(
          "text-sm",
          theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
        )}>
          {invoice.lineItems.length} item{invoice.lineItems.length !== 1 ? 's' : ''}
        </div>

        {/* Payment Info */}
        {invoice.trackPayment !== false && invoice.paymentStatus === 'partial' && (
          <div className={cn(
            "text-sm",
            theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
          )}>
            Paid: {formatCurrency(invoice.paidAmount)} / {formatCurrency(invoice.total)}
          </div>
        )}

        {/* Total */}
        <div className={cn(
          "pt-2 border-t",
          theme === 'dark' ? 'border-primary-blue' : 'border-gray-200'
        )}>
          <div className="flex justify-between items-center">
            <span className={cn(
              "text-sm",
              theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
            )}>Total</span>
            <span className="text-xl font-bold text-primary-gold">
              {formatCurrency(invoice.total)}
            </span>
          </div>
        </div>

        {/* Due Date */}
        {invoice.dueDate && (
          <div
            className={cn(
              'text-xs',
              isOverdue ? 'text-red-400 font-medium' : theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary/70'
            )}
          >
            {isOverdue ? '⚠️ ' : ''}Due: {new Date(invoice.dueDate).toLocaleDateString()}
          </div>
        )}
      </div>
    </Card>
  )
}

export default InvoiceCard
