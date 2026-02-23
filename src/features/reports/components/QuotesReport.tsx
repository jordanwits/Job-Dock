import { useMemo, useState } from 'react'
import { Card, Button } from '@/components/ui'
import { downloadCsv } from '../utils/exportCsv'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { format } from 'date-fns'
import type { Quote } from '@/features/quotes/types/quote'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

interface QuotesReportProps {
  startDate: Date
  endDate: Date
  quotes: Quote[]
}

export const QuotesReport = ({ startDate, endDate, quotes }: QuotesReportProps) => {
  const { theme } = useTheme()
  const [isExpanded, setIsExpanded] = useState(false)
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <h3 className={cn(
              "text-lg font-semibold",
              theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
            )}>Quotes Summary</h3>
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

      {filteredQuotes.length === 0 ? (
        <div className="text-center py-8">
          <p className={cn(
            theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
          )}>No quotes found for this period</p>
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
              )}>Total Quotes</p>
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
              )}>Accepted</p>
              <p className="text-xl md:text-2xl font-bold text-green-400 mt-1 break-words">
                {formatNumber(totals.acceptedCount)}
              </p>
              <p className={cn(
                "text-xs md:text-sm mt-1 break-words",
                theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
              )}>
                ${formatCurrency(totals.accepted)}
              </p>
            </div>
            <div className={cn(
              "p-4 rounded-lg min-w-0",
              theme === 'dark' ? 'bg-primary-dark/50' : 'bg-gray-100'
            )}>
              <p className={cn(
                "text-xs uppercase tracking-wide",
                theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
              )}>Sent</p>
              <p className="text-xl md:text-2xl font-bold text-primary-blue mt-1 break-words">
                {formatNumber(totals.sentCount)}
              </p>
              <p className={cn(
                "text-xs md:text-sm mt-1 break-words",
                theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
              )}>
                ${formatCurrency(totals.sent)}
              </p>
            </div>
            <div className={cn(
              "p-4 rounded-lg min-w-0",
              theme === 'dark' ? 'bg-primary-dark/50' : 'bg-gray-100'
            )}>
              <p className={cn(
                "text-xs uppercase tracking-wide",
                theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
              )}>Draft</p>
              <p className={cn(
                "text-xl md:text-2xl font-bold mt-1 break-words",
                theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
              )}>
                {formatNumber(totals.draftCount)}
              </p>
              <p className={cn(
                "text-xs md:text-sm mt-1 break-words",
                theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
              )}>
                ${formatCurrency(totals.draft)}
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
                  draft: theme === 'dark' 
                    ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' 
                    : 'bg-gray-200 text-gray-600 border-gray-300',
                  sent: theme === 'dark'
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    : 'bg-blue-100 text-blue-700 border-blue-300',
                  accepted: theme === 'dark'
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-green-100 text-green-700 border-green-300',
                  rejected: theme === 'dark'
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-red-100 text-red-700 border-red-300',
                  expired: theme === 'dark'
                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                    : 'bg-orange-100 text-orange-700 border-orange-300',
                }

                const total = group.reduce((sum, q) => sum + q.total, 0)

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
          )}
        </div>
      )}
    </Card>
  )
}
