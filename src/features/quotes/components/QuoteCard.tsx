import { Quote } from '../types/quote'
import { useQuoteStore } from '../store/quoteStore'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'

interface QuoteCardProps {
  quote: Quote
}

const QuoteCard = ({ quote }: QuoteCardProps) => {
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
      className="cursor-pointer hover:border-primary-gold transition-colors"
      onClick={() => setSelectedQuote(quote)}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="text-lg font-semibold text-primary-light">
              {quote.quoteNumber}
              {quote.contactName && quote.title && (
                <span className="text-primary-light/90"> — {quote.contactName} {quote.title}</span>
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

