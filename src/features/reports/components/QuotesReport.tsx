import { useMemo } from 'react'
import { downloadCsv } from '../utils/exportCsv'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { format } from 'date-fns'
import type { Quote } from '@/features/quotes/types/quote'
import type { Invoice } from '@/features/invoices/types/invoice'
import {
  ReportSection,
  StatGrid,
  StatTile,
  BreakdownRow,
  DetailLabel,
  DocumentIcon,
  type Tone,
} from './reportsUi'

type QuoteForReport = Quote & { status?: string }

interface QuotesReportProps {
  startDate: Date
  endDate: Date
  quotes: Quote[]
  invoices?: Invoice[]
}

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'success' },
  rejected: { label: 'Declined', tone: 'danger' },
  expired: { label: 'Expired', tone: 'warning' },
}

export const QuotesReport = ({ startDate, endDate, quotes, invoices = [] }: QuotesReportProps) => {
  // Build converted quote snapshots from invoices that were created from quotes
  const convertedQuotes = useMemo((): QuoteForReport[] => {
    return invoices
      .filter(
        (inv): inv is Invoice & { convertedFromQuoteNumber: string } =>
          !!(inv as Invoice & { convertedFromQuoteNumber?: string }).convertedFromQuoteNumber
      )
      .map(inv => ({
        id: `conv-${inv.id}`,
        quoteNumber: inv.convertedFromQuoteNumber!,
        title: inv.title ?? inv.convertedFromQuoteNumber,
        contactId: inv.contactId,
        contactName: inv.contactName,
        contactCompany: inv.contactCompany,
        lineItems: [],
        subtotal: inv.subtotal,
        taxAmount: inv.taxAmount,
        discount: inv.discount,
        total: inv.convertedFromQuoteTotal ?? inv.total,
        status: 'accepted' as const,
        validUntil: undefined,
        createdAt: inv.convertedFromQuoteCreatedAt ?? inv.createdAt,
        updatedAt: inv.createdAt,
      }))
  }, [invoices])

  // Merge active quotes with converted snapshots, filter by date range (createdAt)
  const filteredQuotes = useMemo(() => {
    const all = [...quotes, ...convertedQuotes]
    return all.filter(quote => {
      const quoteDate = new Date(quote.createdAt)
      return quoteDate >= startDate && quoteDate <= endDate
    })
  }, [quotes, convertedQuotes, startDate, endDate])

  // Group by status
  const statusGroups = useMemo(() => {
    const groups: Record<string, QuoteForReport[]> = {
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

  const isEmpty = filteredQuotes.length === 0

  const details = (
    <div className="space-y-3">
      <DetailLabel>By status</DetailLabel>
      <div className="divide-y divide-line">
        {(['draft', 'sent', 'accepted', 'rejected', 'expired'] as const).map(status => {
          const group = statusGroups[status]
          if (!group || group.length === 0) return null
          const meta = STATUS_META[status]
          const total = group.reduce((sum, q) => sum + q.total, 0)
          return (
            <BreakdownRow
              key={status}
              tone={meta.tone}
              label={meta.label}
              count={`${formatNumber(group.length)} ${group.length === 1 ? 'quote' : 'quotes'}`}
              amount={`$${formatCurrency(total)}`}
            />
          )
        })}
      </div>
    </div>
  )

  return (
    <ReportSection
      title="Quotes"
      onExport={handleExport}
      exportDisabled={isEmpty}
      empty={isEmpty}
      emptyIcon={<DocumentIcon className="h-6 w-6" />}
      emptyText="No quotes found for this period"
      details={details}
    >
      <StatGrid>
        <StatTile
          label="Total Quotes"
          value={formatNumber(totals.count)}
          sub={`$${formatCurrency(totals.total)}`}
          tone="accent"
        />
        <StatTile
          label="Accepted"
          value={formatNumber(totals.acceptedCount)}
          sub={`$${formatCurrency(totals.accepted)}`}
          tone="success"
        />
        <StatTile
          label="Sent"
          value={formatNumber(totals.sentCount)}
          sub={`$${formatCurrency(totals.sent)}`}
          tone="info"
        />
        <StatTile
          label="Draft"
          value={formatNumber(totals.draftCount)}
          sub={`$${formatCurrency(totals.draft)}`}
          tone="muted"
        />
      </StatGrid>
    </ReportSection>
  )
}
