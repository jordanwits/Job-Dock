import { Quote } from '../types/quote'
import { useQuoteStore } from '../store/quoteStore'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

interface QuoteCardProps {
  quote: Quote
  isSelected?: boolean
  onToggleSelect?: (id: string, event: React.MouseEvent) => void
}

const QuoteCard = ({ quote, isSelected, onToggleSelect }: QuoteCardProps) => {
  const { theme } = useTheme()
  const { setSelectedQuote } = useQuoteStore()

  const statusColors = {
    draft: theme === 'dark'
      ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      : 'bg-gray-200 text-gray-600 border-gray-300',
    sent: theme === 'dark'
      ? 'bg-primary-blue/20 text-primary-blue border-primary-blue/30'
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
                  : theme === 'dark'
                    ? 'border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10'
                    : 'border-gray-400 bg-white hover:border-primary-gold/50 hover:bg-primary-gold/10'
              )}
            >
              {isSelected && <div className={cn(
                "w-2.5 h-2.5 rounded-full",
                theme === 'dark' ? 'bg-primary-dark' : 'bg-white'
              )} />}
            </div>
          </div>
        )}

        {/* Header */}
        <div className={cn('flex items-start justify-between', onToggleSelect && 'pl-8')}>
          <div className="flex-1 min-w-0 pr-2">
            <h3 className={cn(
              "text-lg font-semibold",
              theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
            )}>
              {quote.quoteNumber}
              {quote.contactName && quote.title && (
                <span className={cn(
                  theme === 'dark' ? 'text-primary-light/90' : 'text-primary-lightText/90'
                )}>
                  {' '}
                  — {quote.contactName} {quote.title}
                </span>
              )}
            </h3>
            {quote.contactCompany && (
              <p className={cn(
                "text-xs mt-1",
                theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
              )}>{quote.contactCompany}</p>
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
        <div className={cn(
          "text-sm",
          theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
        )}>
          {quote.lineItems.length} item{quote.lineItems.length !== 1 ? 's' : ''}
        </div>

        {/* Total */}
        <div className={cn(
          "pt-2 border-t",
          theme === 'dark' ? 'border-primary-blue' : 'border-gray-200'
        )}>
          <div className="flex justify-between items-center">
            <span className={cn(
              "text-sm",
              theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
            )}>Total</span>
            <span className="text-xl font-bold text-primary-gold">
              {formatCurrency(quote.total)}
            </span>
          </div>
        </div>

        {/* Valid Until */}
        {quote.validUntil && (
          <div className={cn(
            "text-xs",
            theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary/70'
          )}>
            Valid until: {new Date(quote.validUntil).toLocaleDateString()}
          </div>
        )}
      </div>
    </Card>
  )
}

export default QuoteCard
