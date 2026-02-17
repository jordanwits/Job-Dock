import { useMemo } from 'react'
import { Card, Button } from '@/components/ui'
import { downloadCsv } from '../utils/exportCsv'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { format } from 'date-fns'
import type { Invoice } from '@/features/invoices/types/invoice'

interface InvoicesReportProps {
  startDate: Date
  endDate: Date
  invoices: Invoice[]
}

export const InvoicesReport = ({ startDate, endDate, invoices }: InvoicesReportProps) => {
  // Filter invoices by date range (createdAt)
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.createdAt)
      return invoiceDate >= startDate && invoiceDate <= endDate
    })
  }, [invoices, startDate, endDate])

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

    filteredInvoices.forEach(invoice => {
      const paymentStatus = invoice.paymentStatus || 'pending'
      if (groups[paymentStatus]) {
        groups[paymentStatus].push(invoice)
      } else {
        groups[paymentStatus] = [invoice]
      }
    })

    return groups
  }, [filteredInvoices])

  // Calculate totals
  const totals = useMemo(() => {
    const total = filteredInvoices.reduce((sum, i) => sum + i.total, 0)
    const paid = filteredInvoices.reduce((sum, i) => sum + i.paidAmount, 0)
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
      count: filteredInvoices.length,
      sentCount: statusGroups.sent.length,
      overdueCount: statusGroups.overdue.length,
      draftCount: statusGroups.draft.length,
      paidCount: paymentGroups.paid.length,
      partialCount: paymentGroups.partial.length,
      pendingCount: paymentGroups.pending.length,
    }
  }, [filteredInvoices, statusGroups, paymentGroups])

  const handleExport = () => {
    const exportData = filteredInvoices.map(invoice => ({
      'Invoice Number': invoice.invoiceNumber,
      'Title': invoice.title || '',
      'Contact': invoice.contactName || '',
      'Company': invoice.contactCompany || '',
      'Status': invoice.status,
      'Payment Status': invoice.paymentStatus,
      'Subtotal': formatCurrency(invoice.subtotal),
      'Tax': formatCurrency(invoice.taxAmount),
      'Discount': formatCurrency(invoice.discount),
      'Total': formatCurrency(invoice.total),
      'Paid': formatCurrency(invoice.paidAmount),
      'Outstanding': formatCurrency(invoice.total - invoice.paidAmount),
      'Due Date': invoice.dueDate ? format(new Date(invoice.dueDate), 'yyyy-MM-dd') : '',
      'Created': format(new Date(invoice.createdAt), 'yyyy-MM-dd'),
      'Updated': format(new Date(invoice.updatedAt), 'yyyy-MM-dd'),
    }))

    const dateRange = `${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}`
    downloadCsv(exportData, `invoices-${dateRange}`)
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-primary-light">Invoices Summary</h3>
          <p className="text-sm text-primary-light/60 mt-1">
            {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport}>
          Export CSV
        </Button>
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-primary-light/60">No invoices found for this period</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-primary-dark/50 rounded-lg">
              <p className="text-xs text-primary-light/50 uppercase tracking-wide">Total Invoices</p>
              <p className="text-2xl font-bold text-primary-gold mt-1">{formatNumber(totals.count)}</p>
              <p className="text-sm text-primary-light/60 mt-1">${formatCurrency(totals.total)}</p>
            </div>
            <div className="p-4 bg-primary-dark/50 rounded-lg">
              <p className="text-xs text-primary-light/50 uppercase tracking-wide">Paid</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{formatNumber(totals.paidCount)}</p>
              <p className="text-sm text-primary-light/60 mt-1">${formatCurrency(totals.paid)}</p>
            </div>
            <div className="p-4 bg-primary-dark/50 rounded-lg">
              <p className="text-xs text-primary-light/50 uppercase tracking-wide">Outstanding</p>
              <p className="text-2xl font-bold text-primary-blue mt-1">
                ${formatCurrency(totals.outstanding)}
              </p>
              <p className="text-sm text-primary-light/60 mt-1">
                {formatNumber(totals.pendingCount + totals.partialCount)} invoices
              </p>
            </div>
            <div className="p-4 bg-primary-dark/50 rounded-lg">
              <p className="text-xs text-primary-light/50 uppercase tracking-wide">Overdue</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{formatNumber(totals.overdueCount)}</p>
              <p className="text-sm text-primary-light/60 mt-1">${formatCurrency(totals.overdue)}</p>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-primary-light uppercase tracking-wide">
              By Status
            </h4>
            <div className="space-y-2">
              {(['draft', 'sent', 'overdue', 'cancelled'] as const).map(status => {
                const group = statusGroups[status]
                if (group.length === 0) return null

                const statusLabels: Record<string, string> = {
                  draft: 'Draft',
                  sent: 'Sent',
                  overdue: 'Overdue',
                  cancelled: 'Cancelled',
                }

                const statusColors: Record<string, string> = {
                  draft: 'bg-primary-light/10 text-primary-light/70',
                  sent: 'bg-blue-500/10 text-blue-400',
                  overdue: 'bg-red-500/10 text-red-400',
                  cancelled: 'bg-gray-500/10 text-gray-400',
                }

                const total = group.reduce((sum, i) => sum + i.total, 0)

                return (
                  <div
                    key={status}
                    className="flex items-center justify-between p-3 bg-primary-dark/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}
                      >
                        {statusLabels[status]}
                      </span>
                      <span className="text-sm text-primary-light">{formatNumber(group.length)} invoices</span>
                    </div>
                    <span className="text-sm font-semibold text-primary-gold">
                      ${formatCurrency(total)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
