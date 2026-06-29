import { useMemo } from 'react'
import { downloadCsv } from '../utils/exportCsv'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { format } from 'date-fns'
import type { Invoice } from '@/features/invoices/types/invoice'
import {
  ReportSection,
  StatGrid,
  StatTile,
  BreakdownRow,
  DetailLabel,
  ReceiptIcon,
  type Tone,
} from './reportsUi'

interface InvoicesReportProps {
  startDate: Date
  endDate: Date
  invoices: Invoice[]
}

const PAYMENT_META: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Unpaid', tone: 'warning' },
  partial: { label: 'Partially Paid', tone: 'info' },
  paid: { label: 'Paid', tone: 'success' },
}

export const InvoicesReport = ({ startDate, endDate, invoices }: InvoicesReportProps) => {
  // Filter invoices by date range (createdAt)
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.createdAt)
      return invoiceDate >= startDate && invoiceDate <= endDate
    })
  }, [invoices, startDate, endDate])

  // Billable invoices = issued and not voided. Drafts (not yet sent) and cancelled
  // invoices are excluded from every revenue / outstanding figure — they aren't
  // receivables, so counting them would overstate income and money owed.
  const billableInvoices = useMemo(
    () => filteredInvoices.filter(i => i.status !== 'draft' && i.status !== 'cancelled'),
    [filteredInvoices]
  )

  // Group by status and payment status
  const statusGroups = useMemo(() => {
    const groups: Record<string, Invoice[]> = {
      draft: [],
      sent: [],
      overdue: [],
      cancelled: [],
    }

    filteredInvoices.forEach(invoice => {
      const status = invoice.status || 'draft'
      if (groups[status]) {
        groups[status].push(invoice)
      } else {
        groups[status] = [invoice]
      }
    })

    return groups
  }, [filteredInvoices])

  const paymentGroups = useMemo(() => {
    const groups: Record<string, Invoice[]> = {
      pending: [],
      partial: [],
      paid: [],
    }

    billableInvoices.forEach(invoice => {
      const paymentStatus = invoice.paymentStatus || 'pending'
      if (groups[paymentStatus]) {
        groups[paymentStatus].push(invoice)
      } else {
        groups[paymentStatus] = [invoice]
      }
    })

    return groups
  }, [billableInvoices])

  // Calculate totals
  const totals = useMemo(() => {
    // Revenue/outstanding are computed over billable invoices only (no draft/cancelled).
    const total = billableInvoices.reduce((sum, i) => sum + i.total, 0)
    const paid = billableInvoices.reduce((sum, i) => sum + i.paidAmount, 0)
    const outstanding = total - paid

    const sent = statusGroups.sent.reduce((sum, i) => sum + i.total, 0)
    const overdue = statusGroups.overdue.reduce((sum, i) => sum + (i.total - i.paidAmount), 0)
    const draft = statusGroups.draft.reduce((sum, i) => sum + i.total, 0)

    return {
      total,
      paid,
      outstanding,
      sent,
      overdue,
      draft,
      count: billableInvoices.length,
      excludedCount: filteredInvoices.length - billableInvoices.length,
      sentCount: statusGroups.sent.length,
      overdueCount: statusGroups.overdue.length,
      draftCount: statusGroups.draft.length,
      paidCount: paymentGroups.paid.length,
      partialCount: paymentGroups.partial.length,
      pendingCount: paymentGroups.pending.length,
    }
  }, [filteredInvoices, billableInvoices, statusGroups, paymentGroups])

  const paymentStatusLabel = (ps: string | undefined) =>
    ps === 'pending' ? 'Unpaid' : ps === 'partial' ? 'Partially Paid' : ps === 'paid' ? 'Paid' : ps ?? ''

  const handleExport = () => {
    const exportData = filteredInvoices.map(invoice => ({
      'Invoice Number': invoice.invoiceNumber,
      Title: invoice.title || '',
      Contact: invoice.contactName || '',
      Company: invoice.contactCompany || '',
      Status: invoice.status,
      'Payment Status': paymentStatusLabel(invoice.paymentStatus),
      Subtotal: formatCurrency(invoice.subtotal),
      Tax: formatCurrency(invoice.taxAmount),
      Discount: formatCurrency(invoice.discount),
      Total: formatCurrency(invoice.total),
      Paid: formatCurrency(invoice.paidAmount),
      Outstanding: formatCurrency(invoice.total - invoice.paidAmount),
      'Due Date': invoice.dueDate ? format(new Date(invoice.dueDate), 'yyyy-MM-dd') : '',
      Created: format(new Date(invoice.createdAt), 'yyyy-MM-dd'),
      Updated: format(new Date(invoice.updatedAt), 'yyyy-MM-dd'),
    }))

    const dateRange = `${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}`
    downloadCsv(exportData, `invoices-${dateRange}`)
  }

  const isEmpty = filteredInvoices.length === 0

  const details = (
    <div className="space-y-3">
      <DetailLabel>By payment status</DetailLabel>
      <div className="divide-y divide-line">
        {(['pending', 'partial', 'paid'] as const).map(paymentStatus => {
          const group = paymentGroups[paymentStatus]
          if (!group || group.length === 0) return null
          const meta = PAYMENT_META[paymentStatus]
          const total = group.reduce((sum, i) => sum + i.total, 0)
          const paidAmount = group.reduce((sum, i) => sum + i.paidAmount, 0)
          return (
            <BreakdownRow
              key={paymentStatus}
              tone={meta.tone}
              label={meta.label}
              count={`${formatNumber(group.length)} ${group.length === 1 ? 'invoice' : 'invoices'}`}
              amount={`$${formatCurrency(total)}`}
              sub={paymentStatus !== 'pending' ? `$${formatCurrency(paidAmount)} paid` : undefined}
            />
          )
        })}
      </div>
    </div>
  )

  return (
    <ReportSection
      title="Invoices"
      onExport={handleExport}
      exportDisabled={isEmpty}
      empty={isEmpty}
      emptyIcon={<ReceiptIcon className="h-6 w-6" />}
      emptyText="No invoices found for this period"
      details={details}
    >
      <div className="space-y-2">
        <StatGrid>
          <StatTile
            label="Total Invoices"
            value={formatNumber(totals.count)}
            sub={`$${formatCurrency(totals.total)}`}
            tone="accent"
          />
          <StatTile
            label="Paid"
            value={formatNumber(totals.paidCount)}
            sub={`$${formatCurrency(totals.paid)}`}
            tone="success"
          />
          <StatTile
            label="Outstanding"
            value={`$${formatCurrency(totals.outstanding)}`}
            sub={`${formatNumber(totals.pendingCount + totals.partialCount)} ${
              totals.pendingCount + totals.partialCount === 1 ? 'invoice' : 'invoices'
            }`}
            tone="info"
          />
          <StatTile
            label="Overdue"
            value={formatNumber(totals.overdueCount)}
            sub={`$${formatCurrency(totals.overdue)}`}
            tone={totals.overdueCount > 0 ? 'danger' : 'ink'}
          />
        </StatGrid>
        {totals.excludedCount > 0 && (
          <p className="text-[13px] text-ink-subtle">
            Excludes {formatNumber(totals.excludedCount)}{' '}
            {totals.excludedCount === 1 ? 'draft or cancelled invoice' : 'draft or cancelled invoices'}.
          </p>
        )}
      </div>
    </ReportSection>
  )
}
