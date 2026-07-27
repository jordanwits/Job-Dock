import { Invoice } from '../types/invoice'
import { useInvoiceStore } from '../store/invoiceStore'
import { cn } from '@/lib/utils'
import { formatDateOnly } from '@/lib/utils/dateUtils'
import { SelectCircle, StatusBadge } from './invoicesUi'
import { INVOICE_STATUS, PAYMENT_STATUS, isInvoiceOverdue } from './invoiceStatus'

interface InvoiceCardProps {
  invoice: Invoice
  isSelected?: boolean
  onToggleSelect?: (id: string, event: React.MouseEvent) => void
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

const InvoiceCard = ({ invoice, isSelected, onToggleSelect }: InvoiceCardProps) => {
  const { setSelectedInvoice } = useInvoiceStore()
  const status = INVOICE_STATUS[invoice.status] ?? INVOICE_STATUS.draft
  const payment = PAYMENT_STATUS[invoice.paymentStatus] ?? PAYMENT_STATUS.pending
  const itemCount = invoice.lineItems.length

  const showPayment = invoice.trackPayment !== false
  const isOverdue = isInvoiceOverdue(invoice)

  // Only show the lifecycle status when it adds info beyond the payment badge.
  // Hide it for "sent" (the payment badge already conveys pending/partial/paid).
  // "overdue" is gated on the derived value, never the stored status, so a paid-late
  // invoice cannot render "Overdue" and "Paid" side by side.
  const shouldShowStatus =
    invoice.status === 'draft' ||
    invoice.status === 'cancelled' ||
    (invoice.status === 'overdue' && isOverdue)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setSelectedInvoice(invoice)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setSelectedInvoice(invoice)
        }
      }}
      className={cn(
        'group relative flex cursor-pointer flex-col rounded-xl bg-surface p-5 shadow-card outline-none transition-shadow hover:shadow-pop focus-visible:ring-2 focus-visible:ring-accent',
        isSelected && 'ring-2 ring-accent'
      )}
    >
      {/* Top row: invoice number + badges / selection */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-mono text-sm font-semibold tabular-nums text-ink">
            {invoice.invoiceNumber}
          </h3>
          {invoice.title && <p className="mt-1 truncate text-[15px] font-semibold text-ink">{invoice.title}</p>}
          {invoice.contactName && (
            <p className="mt-0.5 truncate text-[13px] text-ink-muted">
              {invoice.contactName}
              {invoice.contactCompany ? ` · ${invoice.contactCompany}` : ''}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            {shouldShowStatus && <StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
            {showPayment && <StatusBadge tone={payment.tone}>{payment.label}</StatusBadge>}
          </div>
          {onToggleSelect && (
            <SelectCircle
              selected={!!isSelected}
              onClick={e => {
                e.stopPropagation()
                onToggleSelect(invoice.id, e)
              }}
            />
          )}
        </div>
      </div>

      {/* Partial payment progress */}
      {showPayment && invoice.paymentStatus === 'partial' && (
        <p className="mt-3 text-[13px] text-ink-muted">
          Paid <span className="font-mono tabular-nums text-ink">{formatCurrency(invoice.paidAmount)}</span>
          {' '}of <span className="font-mono tabular-nums">{formatCurrency(invoice.total)}</span>
        </p>
      )}

      {/* Total */}
      <div className="mt-5 flex items-end justify-between gap-3 border-t border-line pt-4">
        <span className="text-[13px] text-ink-muted">
          <span className="font-mono tabular-nums text-ink">{itemCount}</span>{' '}
          {itemCount === 1 ? 'item' : 'items'}
        </span>
        <span className="font-mono text-xl font-semibold tabular-nums text-ink">
          {formatCurrency(invoice.total)}
        </span>
      </div>

      {/* Due date */}
      {invoice.dueDate && (
        <p className={cn('mt-2 text-[12px]', isOverdue ? 'font-medium text-danger' : 'text-ink-subtle')}>
          {isOverdue ? 'Overdue · due ' : 'Due '}
          <span className="font-mono tabular-nums">{formatDateOnly(invoice.dueDate)}</span>
        </p>
      )}
    </div>
  )
}

export default InvoiceCard
