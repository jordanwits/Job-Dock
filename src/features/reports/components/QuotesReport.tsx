import { useMemo } from 'react'
import { Card, Button } from '@/components/ui'
import { downloadCsv } from '../utils/exportCsv'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { format } from 'date-fns'
import type { Quote } from '@/features/quotes/types/quote'

interface QuotesReportProps {
  startDate: Date
  endDate: Date
  quotes: Quote[]
}

export const QuotesReport = ({ startDate, endDate, quotes }: QuotesReportProps) => {
  // Filter quotes by date range (createdAt)
  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => {
      const quoteDate = new Date(quote.createdAt)
      return quoteDate >= startDate && quoteDate <= endDate
    })
  }, [quotes, startDate, endDate])

  // Group by status
  const statusGroups = useMemo(() => {
    const groups: Record<string, Quote[]> = {
      draft: [],
      sent: [],
      accepted: [],
      rejected: [],
      expired: [],
    }

    filteredQuotes.forEach(quote => {
      const status = quote.status || 'draft'
      if (groups[status]) {
        groups[status].push(quote)
      } else {
        groups[status] = [quote]
      }
    })

    return groups
  }, [filteredQuotes])

  // Calculate totals
  const totals = useMemo(() => {
    const total = filteredQuotes.reduce((sum, q) => sum + q.total, 0)
    const accepted = statusGroups.accepted.reduce((sum, q) => sum + q.total, 0)
    const sent = statusGroups.sent.reduce((sum, q) => sum + q.total, 0)
    const draft = statusGroups.draft.reduce((sum, q) => sum + q.total, 0)

    return {
      total,
      accepted,
      sent,
      draft,
      count: filteredQuotes.length,
      acceptedCount: statusGroups.accepted.length,
      sentCount: statusGroups.sent.length,
      draftCount: statusGroups.draft.length,
    }
  }, [filteredQuotes, statusGroups])

  const handleExport = () => {
    const exportData = filteredQuotes.map(quote => ({
      'Quote Number': quote.quoteNumber,
      Title: quote.title || '',
      Contact: quote.contactName || '',
      Company: quote.contactCompany || '',
      Status: quote.status,
      Subtotal: formatCurrency(quote.subtotal),
      Tax: formatCurrency(quote.taxAmount),
      Discount: formatCurrency(quote.discount),
      Total: formatCurrency(quote.total),
      'Valid Until': quote.validUntil ? format(new Date(quote.validUntil), 'yyyy-MM-dd') : '',
      Created: format(new Date(quote.createdAt), 'yyyy-MM-dd'),
      Updated: format(new Date(quote.updatedAt), 'yyyy-MM-dd'),
    }))

    const dateRange = `${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}`
    downloadCsv(exportData, `quotes-${dateRange}`)
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-primary-light">Quotes Summary</h3>
          <p className="text-sm text-primary-light/60 mt-1">
            {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport}>
          Export CSV
        </Button>
      </div>

      {filteredQuotes.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-primary-light/60">No quotes found for this period</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-primary-dark/50 rounded-lg min-w-0">
              <p className="text-xs text-primary-light/50 uppercase tracking-wide">Total Quotes</p>
              <p className="text-xl md:text-2xl font-bold text-primary-gold mt-1 break-words">
                {formatNumber(totals.count)}
              </p>
              <p className="text-xs md:text-sm text-primary-light/60 mt-1 break-words">
                ${formatCurrency(totals.total)}
              </p>
            </div>
            <div className="p-4 bg-primary-dark/50 rounded-lg min-w-0">
              <p className="text-xs text-primary-light/50 uppercase tracking-wide">Accepted</p>
              <p className="text-xl md:text-2xl font-bold text-green-400 mt-1 break-words">
                {formatNumber(totals.acceptedCount)}
              </p>
              <p className="text-xs md:text-sm text-primary-light/60 mt-1 break-words">
                ${formatCurrency(totals.accepted)}
              </p>
            </div>
            <div className="p-4 bg-primary-dark/50 rounded-lg min-w-0">
              <p className="text-xs text-primary-light/50 uppercase tracking-wide">Sent</p>
              <p className="text-xl md:text-2xl font-bold text-primary-blue mt-1 break-words">
                {formatNumber(totals.sentCount)}
              </p>
              <p className="text-xs md:text-sm text-primary-light/60 mt-1 break-words">
                ${formatCurrency(totals.sent)}
              </p>
            </div>
            <div className="p-4 bg-primary-dark/50 rounded-lg min-w-0">
              <p className="text-xs text-primary-light/50 uppercase tracking-wide">Draft</p>
              <p className="text-xl md:text-2xl font-bold text-primary-light/70 mt-1 break-words">
                {formatNumber(totals.draftCount)}
              </p>
              <p className="text-xs md:text-sm text-primary-light/60 mt-1 break-words">
                ${formatCurrency(totals.draft)}
              </p>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-primary-light uppercase tracking-wide">
              By Status
            </h4>
            <div className="space-y-2">
              {(['draft', 'sent', 'accepted', 'rejected', 'expired'] as const).map(status => {
                const group = statusGroups[status]
                if (group.length === 0) return null

                const statusLabels: Record<string, string> = {
                  draft: 'Draft',
                  sent: 'Sent',
                  accepted: 'Accepted',
                  rejected: 'Rejected',
                  expired: 'Expired',
                }

                const statusColors: Record<string, string> = {
                  draft: 'bg-primary-light/10 text-primary-light/70',
                  sent: 'bg-blue-500/10 text-blue-400',
                  accepted: 'bg-green-500/10 text-green-400',
                  rejected: 'bg-red-500/10 text-red-400',
                  expired: 'bg-orange-500/10 text-orange-400',
                }

                const total = group.reduce((sum, q) => sum + q.total, 0)

                return (
                  <div
                    key={status}
                    className="flex items-center justify-between p-3 bg-primary-dark/30 rounded-lg gap-2 min-w-0"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${statusColors[status]}`}
                      >
                        {statusLabels[status]}
                      </span>
                      <span className="text-xs md:text-sm text-primary-light truncate">
                        {formatNumber(group.length)} quotes
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
        </div>
      )}
    </Card>
  )
}
