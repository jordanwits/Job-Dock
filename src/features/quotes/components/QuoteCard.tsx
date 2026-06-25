import { Quote } from '../types/quote'
import { useQuoteStore } from '../store/quoteStore'
import { SelectCircle, StatusBadge } from './quotesUi'
import { QUOTE_STATUS } from './quoteStatus'

interface QuoteCardProps {
  quote: Quote
  isSelected?: boolean
  onToggleSelect?: (id: string, event: React.MouseEvent) => void
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

const QuoteCard = ({ quote, isSelected, onToggleSelect }: QuoteCardProps) => {
  const { setSelectedQuote } = useQuoteStore()
  const status = QUOTE_STATUS[quote.status] ?? QUOTE_STATUS.draft
  const itemCount = quote.lineItems.length

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setSelectedQuote(quote)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setSelectedQuote(quote)
        }
      }}
      className={
        'group relative flex cursor-pointer flex-col rounded-xl bg-surface p-5 shadow-card outline-none transition-shadow hover:shadow-pop focus-visible:ring-2 focus-visible:ring-accent' +
        (isSelected ? ' ring-2 ring-accent' : '')
      }
    >
      {/* Top row: quote number + status / selection */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-mono text-sm font-semibold tabular-nums text-ink">
            {quote.quoteNumber}
          </h3>
          {quote.title && <p className="mt-1 truncate text-[15px] font-semibold text-ink">{quote.title}</p>}
          {quote.contactName && (
            <p className="mt-0.5 truncate text-[13px] text-ink-muted">
              {quote.contactName}
              {quote.contactCompany ? ` · ${quote.contactCompany}` : ''}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          {onToggleSelect && (
            <SelectCircle
              selected={!!isSelected}
              onClick={e => {
                e.stopPropagation()
                onToggleSelect(quote.id, e)
              }}
            />
          )}
        </div>
      </div>

      {/* Total */}
      <div className="mt-5 flex items-end justify-between gap-3 border-t border-line pt-4">
        <span className="text-[13px] text-ink-muted">
          <span className="font-mono tabular-nums text-ink">{itemCount}</span>{' '}
          {itemCount === 1 ? 'item' : 'items'}
        </span>
        <span className="font-mono text-xl font-semibold tabular-nums text-ink">
          {formatCurrency(quote.total)}
        </span>
      </div>

      {/* Valid until */}
      {quote.validUntil && (
        <p className="mt-2 text-[12px] text-ink-subtle">
          Valid until{' '}
          <span className="font-mono tabular-nums">
            {new Date(quote.validUntil).toLocaleDateString()}
          </span>
        </p>
      )}
    </div>
  )
}

export default QuoteCard
