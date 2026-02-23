import { useMemo, useState } from 'react'
import { Card, Button } from '@/components/ui'
import { downloadCsv } from '../utils/exportCsv'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { format } from 'date-fns'
import type { Invoice } from '@/features/invoices/types/invoice'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

interface InvoicesReportProps {
  startDate: Date
  endDate: Date
  invoices: Invoice[]
}

export const InvoicesReport = ({ startDate, endDate, invoices }: InvoicesReportProps) => {
  const { theme } = useTheme()
  const [isExpanded, setIsExpanded] = useState(false)
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
      Title: invoice.title || '',
      Contact: invoice.contactName || '',
      Company: invoice.contactCompany || '',
      Status: invoice.status,
      'Payment Status': invoice.paymentStatus,
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

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <h3 className={cn(
              "text-lg font-semibold",
              theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
            )}>Invoices Summary</h3>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 text-primary-gold hover:text-primary-gold/80 transition-colors text-sm font-medium self-start sm:self-center"
              aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
            >
              <span>Details</span>
              <svg
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <p className={cn(
            "text-sm mt-1",
            theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
          )}>
            {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport} className="self-start sm:self-auto">
          Export CSV
        </Button>
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="text-center py-8">
          <p className={cn(
            theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
          )}>No invoices found for this period</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={cn(
              "p-4 rounded-lg min-w-0",
              theme === 'dark' ? 'bg-primary-dark/50' : 'bg-gray-100'
            )}>
              <p className={cn(
                "text-xs uppercase tracking-wide",
                theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
              )}>
                Total Invoices
              </p>
              <p className="text-xl md:text-2xl font-bold text-primary-gold mt-1 break-words">
                {formatNumber(totals.count)}
              </p>
              <p className={cn(
                "text-xs md:text-sm mt-1 break-words",
                theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
              )}>
                ${formatCurrency(totals.total)}
              </p>
            </div>
            <div className={cn(
              "p-4 rounded-lg min-w-0",
              theme === 'dark' ? 'bg-primary-dark/50' : 'bg-gray-100'
            )}>
              <p className={cn(
                "text-xs uppercase tracking-wide",
                theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
              )}>Paid</p>
              <p className="text-xl md:text-2xl font-bold text-green-400 mt-1 break-words">
                {formatNumber(totals.paidCount)}
              </p>
              <p className={cn(
                "text-xs md:text-sm mt-1 break-words",
                theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
              )}>
                ${formatCurrency(totals.paid)}
              </p>
            </div>
            <div className={cn(
              "p-4 rounded-lg min-w-0",
              theme === 'dark' ? 'bg-primary-dark/50' : 'bg-gray-100'
            )}>
              <p className={cn(
                "text-xs uppercase tracking-wide",
                theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
              )}>Outstanding</p>
              <p className="text-xl md:text-2xl font-bold text-primary-blue mt-1 break-words">
                ${formatCurrency(totals.outstanding)}
              </p>
              <p className={cn(
                "text-xs md:text-sm mt-1 break-words",
                theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
              )}>
                {formatNumber(totals.pendingCount + totals.partialCount)} invoices
              </p>
            </div>
            <div className={cn(
              "p-4 rounded-lg min-w-0",
              theme === 'dark' ? 'bg-primary-dark/50' : 'bg-gray-100'
            )}>
              <p className={cn(
                "text-xs uppercase tracking-wide",
                theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
              )}>Overdue</p>
              <p className="text-xl md:text-2xl font-bold text-red-400 mt-1 break-words">
                {formatNumber(totals.overdueCount)}
              </p>
              <p className={cn(
                "text-xs md:text-sm mt-1 break-words",
                theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
              )}>
                ${formatCurrency(totals.overdue)}
              </p>
            </div>
          </div>

          {/* Status Breakdown - Collapsible */}
          {isExpanded && (
            <div className="space-y-3">
              <h4 className={cn(
                "text-sm font-semibold uppercase tracking-wide",
                theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
              )}>
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
                  draft: theme === 'dark' 
                    ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' 
                    : 'bg-gray-200 text-gray-600 border-gray-300',
                  sent: theme === 'dark'
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    : 'bg-blue-100 text-blue-700 border-blue-300',
                  overdue: theme === 'dark'
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-red-100 text-red-700 border-red-300',
                  cancelled: theme === 'dark'
                    ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    : 'bg-gray-200 text-gray-600 border-gray-300',
                }

                const total = group.reduce((sum, i) => sum + i.total, 0)

                return (
                  <div
                    key={status}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg gap-2 min-w-0",
                      theme === 'dark' ? 'bg-primary-dark/30' : 'bg-gray-100'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${statusColors[status]}`}
                      >
                        {statusLabels[status]}
                      </span>
                      <span className={cn(
                        "text-xs md:text-sm truncate",
                        theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                      )}>
                        {formatNumber(group.length)} invoices
                      </span>
                    </div>
                    <span className="text-xs md:text-sm font-semibold text-primary-gold shrink-0 break-words text-right">
                      ${formatCurrency(total)}
                    </span>
                  </div>
                )
              })}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
