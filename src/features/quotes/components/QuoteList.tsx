import { useEffect, useMemo } from 'react'
import { useQuoteStore } from '../store/quoteStore'
import QuoteCard from './QuoteCard'
import { Input, Button, Select } from '@/components/ui'

const QuoteList = () => {
  const {
    quotes,
    isLoading,
    error,
    searchQuery,
    statusFilter,
    fetchQuotes,
    setSearchQuery,
    setStatusFilter,
    clearError,
  } = useQuoteStore()

  useEffect(() => {
    fetchQuotes()
  }, [fetchQuotes])

  // Filter and search quotes
  const filteredQuotes = useMemo(() => {
    let filtered = quotes

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((quote) => quote.status === statusFilter)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (quote) =>
          quote.quoteNumber.toLowerCase().includes(query) ||
          quote.contactName?.toLowerCase().includes(query) ||
          quote.contactCompany?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [quotes, statusFilter, searchQuery])

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 border border-red-500 p-4">
        <p className="text-sm text-red-500">{error}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearError()
            fetchQuotes()
          }}
          className="mt-2"
        >
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search quotes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as 'all' | 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
              )
            }
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'draft', label: 'Draft' },
              { value: 'sent', label: 'Sent' },
              { value: 'accepted', label: 'Accepted' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'expired', label: 'Expired' },
            ]}
            className="min-w-[140px]"
          />
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-primary-light/70">
        {filteredQuotes.length} quote{filteredQuotes.length !== 1 ? 's' : ''} found
      </div>

      {/* Quote List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-primary-light/70">Loading quotes...</p>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-primary-light/70 mb-4">
            {searchQuery || statusFilter !== 'all'
              ? 'No quotes match your filters'
              : 'No quotes yet'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <Button variant="primary">Create Your First Quote</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuotes.map((quote) => (
            <QuoteCard key={quote.id} quote={quote} />
          ))}
        </div>
      )}
    </div>
  )
}

export default QuoteList

