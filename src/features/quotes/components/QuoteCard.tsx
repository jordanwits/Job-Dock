import { Quote } from '../types/quote'
import { useQuoteStore } from '../store/quoteStore'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'

interface QuoteCardProps {
  quote: Quote
  isSelected?: boolean
  onToggleSelect?: (id: string, event: React.MouseEvent) => void
}

const QuoteCard = ({ quote, isSelected, onToggleSelect }: QuoteCardProps) => {
  const { setSelectedQuote } = useQuoteStore()

  const statusColors = {
    draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    sent: 'bg-primary-blue/30 text-primary-light border-primary-blue/50',
    accepted: 'bg-green-500/20 text-green-400 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    expired: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  return (
    <Card
      className={cn(
        'cursor-pointer hover:border-primary-gold transition-colors relative',
        isSelected && 'ring-2 ring-primary-gold'
      )}
      onClick={() => setSelectedQuote(quote)}
    >
      <div className="space-y-3">
        {/* Selection Bullet Point */}
        {onToggleSelect && (
          <div
            className="absolute top-3 left-3 z-10"
            onClick={e => {
              e.stopPropagation()
              onToggleSelect(quote.id, e)
            }}
          >
            <div
              className={cn(
                'w-5 h-5 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center',
                isSelected
                  ? 'bg-primary-gold border-primary-gold shadow-lg shadow-primary-gold/50'
                  : 'border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10'
              )}
            >
              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary-dark" />}
            </div>
          </div>
        )}

        {/* Header */}
        <div className={cn('flex items-start justify-between', onToggleSelect && 'pl-8')}>
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="text-lg font-semibold text-primary-light">
              {quote.quoteNumber}
              {quote.contactName && quote.title && (
                <span className="text-primary-light/90">
                  {' '}
                  — {quote.contactName} {quote.title}
                </span>
              )}
            </h3>
            {quote.contactCompany && (
              <p className="text-xs text-primary-light/50 mt-1">{quote.contactCompany}</p>
            )}
          </div>
          <span
            className={cn(
              'px-2 py-1 text-xs font-medium rounded border flex-shrink-0',
              statusColors[quote.status]
            )}
          >
            {quote.status}
          </span>
        </div>

        {/* Line Items Count */}
        <div className="text-sm text-primary-light/70">
          {quote.lineItems.length} item{quote.lineItems.length !== 1 ? 's' : ''}
        </div>

        {/* Total */}
        <div className="pt-2 border-t border-primary-blue">
          <div className="flex justify-between items-center">
            <span className="text-sm text-primary-light/70">Total</span>
            <span className="text-xl font-bold text-primary-gold">
              {formatCurrency(quote.total)}
            </span>
          </div>
        </div>

        {/* Valid Until */}
        {quote.validUntil && (
          <div className="text-xs text-primary-light/50">
            Valid until: {new Date(quote.validUntil).toLocaleDateString()}
          </div>
        )}
      </div>
    </Card>
  )
}

export default QuoteCard
