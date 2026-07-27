import type { Invoice, InvoiceStatus, PaymentStatus, ApprovalStatus } from '../types/invoice'

/**
 * Whether an invoice is actually overdue, right now.
 *
 * Prefer this over `invoice.status === 'overdue'`. The stored status is a lifecycle field the
 * backend only ever moves forwards (sent -> overdue), so a paid-late invoice can still carry
 * status='overdue' and render a contradictory "Overdue" + "Paid" pair. Deriving it here keeps
 * the UI honest even for legacy rows written before the backend learned to clear the flag.
 *
 * Overdue means: has a due date, is not fully paid, and the due date is more than a day past
 * (a same-day due date is not yet late).
 */
export const isInvoiceOverdue = (invoice: Pick<Invoice, 'dueDate' | 'paymentStatus'>): boolean => {
  if (!invoice.dueDate) return false
  if (invoice.paymentStatus === 'paid') return false

  const endOfYesterday = new Date()
  endOfYesterday.setDate(endOfYesterday.getDate() - 1)
  endOfYesterday.setHours(23, 59, 59, 999)

  return new Date(invoice.dueDate) < endOfYesterday
}

/** Semantic tone vocabulary shared across the invoices surface. */
export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/** Invoice lifecycle status → label + tone. Overdue is the urgent (filled) state. */
export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'info' },
  overdue: { label: 'Overdue', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'warning' },
}

/** Payment status → label + tone (pending reads as "Unpaid"). */
export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Unpaid', tone: 'warning' },
  partial: { label: 'Partial', tone: 'info' },
  paid: { label: 'Paid', tone: 'success' },
}

/** Client approval status → label + tone. */
export const APPROVAL_STATUS: Record<ApprovalStatus, { label: string; tone: Tone }> = {
  none: { label: 'No response', tone: 'neutral' },
  accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'danger' },
}

const INVOICE_STATUS_ORDER: InvoiceStatus[] = ['draft', 'sent', 'overdue', 'cancelled']

/** Options for the interactive StatusSelect on the detail view. */
export const INVOICE_STATUS_OPTIONS: { value: InvoiceStatus; label: string; tone: Tone }[] =
  INVOICE_STATUS_ORDER.map(v => ({ value: v, label: INVOICE_STATUS[v].label, tone: INVOICE_STATUS[v].tone }))

/** Options for the list status filter (includes an "All" entry). */
export const INVOICE_STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All status' },
  ...INVOICE_STATUS_ORDER.map(v => ({ value: v, label: INVOICE_STATUS[v].label })),
]

/** Options for the list payment filter (includes an "All" entry). */
export const PAYMENT_STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All payments' },
  { value: 'pending', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
]
