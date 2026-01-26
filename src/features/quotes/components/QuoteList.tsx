import { useEffect, useMemo, useState } from 'react'
import { useQuoteStore } from '../store/quoteStore'
import QuoteCard from './QuoteCard'
import { Input, Button, Select } from '@/components/ui'
import { cn } from '@/lib/utils'
import { quotesService } from '@/lib/api/services'

interface QuoteListProps {
  onCreateClick?: () => void
}

type DisplayMode = 'cards' | 'list'

const QuoteList = ({ onCreateClick }: QuoteListProps) => {
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
    setSelectedQuote,
    deleteQuote,
  } = useQuoteStore()

  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    const saved = localStorage.getItem('quotes-display-mode')
    return (saved as DisplayMode) || 'cards'
  })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchQuotes()
  }, [fetchQuotes])

  // Persist display mode preference
  useEffect(() => {
    localStorage.setItem('quotes-display-mode', displayMode)
  }, [displayMode])

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
          quote.title?.toLowerCase().includes(query) ||
          quote.contactName?.toLowerCase().includes(query) ||
          quote.contactCompany?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [quotes, statusFilter, searchQuery])

  // Handle bulk delete
  const handleBulkDelete = async () => {
    try {
      setIsDeleting(true)
      const idsToDelete = Array.from(selectedIds)
      const errors: string[] = []
      
      // Delete quotes in batches of 5 to balance speed and reliability
      const BATCH_SIZE = 5
      for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
        const batch = idsToDelete.slice(i, i + BATCH_SIZE)
        const results = await Promise.allSettled(
          // Call API directly to avoid UI updates during deletion
          batch.map(id => quotesService.delete(id))
        )
        
        // Track which ones failed
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const failedId = batch[index]
            console.error(`Failed to delete quote ${failedId}:`, result.reason)
            errors.push(failedId)
          }
        })
      }
      
      // Refresh the entire list once at the end to prevent flashing
      await fetchQuotes()
      
      // Only clear successfully deleted quotes
      if (errors.length > 0) {
        setSelectedIds(new Set(errors))
        alert(`${idsToDelete.length - errors.length} quote(s) deleted successfully. ${errors.length} quote(s) failed - they remain selected for retry.`)
      } else {
        setSelectedIds(new Set())
      }
      setShowDeleteConfirm(false)
    } catch (error) {
      console.error('Error deleting quotes:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  // Toggle selection
  const toggleSelection = (id: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  // Select all/none
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQuotes.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredQuotes.map(q => q.id)))
    }
  }

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
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
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
            className="w-full sm:w-auto min-w-[140px]"
          />
          <div className="flex gap-1 border border-primary-blue rounded-lg p-1">
            <button
              onClick={() => setDisplayMode('cards')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                displayMode === 'cards'
                  ? 'bg-primary-gold text-primary-dark'
                  : 'text-primary-light hover:bg-primary-blue/20'
              }`}
              title="Card View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setDisplayMode('list')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                displayMode === 'list'
                  ? 'bg-primary-gold text-primary-dark'
                  : 'text-primary-light hover:bg-primary-blue/20'
              }`}
              title="List View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Results Count and Bulk Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-primary-light/70">
          {selectedIds.size > 0 ? (
            <span className="font-medium text-primary-gold">
              {selectedIds.size} selected
            </span>
          ) : (
            `${filteredQuotes.length} quote${filteredQuotes.length !== 1 ? 's' : ''} found`
          )}
        </div>
        {selectedIds.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Selected ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-primary-dark border border-red-500/30 rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-red-400 mb-2">Delete {selectedIds.size} Quote{selectedIds.size !== 1 ? 's' : ''}?</h3>
                <p className="text-sm text-primary-light/70 mb-4">
                  This action cannot be undone. All selected quotes will be permanently removed.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                    className="bg-red-500 hover:bg-red-600 text-white"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
          {!searchQuery && statusFilter === 'all' && onCreateClick && (
            <Button variant="primary" onClick={onCreateClick}>Create Your First Quote</Button>
          )}
        </div>
      ) : displayMode === 'cards' ? (
        // Card Grid Layout
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuotes.map((quote) => (
            <QuoteCard 
              key={quote.id} 
              quote={quote}
              isSelected={selectedIds.has(quote.id)}
              onToggleSelect={toggleSelection}
            />
          ))}
        </div>
      ) : (
        // List Layout
        <div className="rounded-lg border border-primary-blue overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-primary-dark-secondary border-b border-primary-blue">
                <tr>
                  <th className="px-4 py-3 w-12">
                    <div 
                      onClick={toggleSelectAll}
                      className={cn(
                        "w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center mx-auto",
                        selectedIds.size === filteredQuotes.length && filteredQuotes.length > 0
                          ? "bg-primary-gold border-primary-gold shadow-lg shadow-primary-gold/50" 
                          : "border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10"
                      )}
                    >
                      {selectedIds.size === filteredQuotes.length && filteredQuotes.length > 0 && (
                        <div className="w-2 h-2 rounded-full bg-primary-dark" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider">
                    Quote #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider hidden md:table-cell">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider hidden sm:table-cell">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider hidden lg:table-cell">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-primary-light/70 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-blue">
                {filteredQuotes.map((quote) => (
                  <tr 
                    key={quote.id} 
                    className="bg-primary-dark hover:bg-primary-dark/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedQuote(quote)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div 
                        onClick={(e) => toggleSelection(quote.id, e)}
                        className={cn(
                          "w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center mx-auto",
                          selectedIds.has(quote.id)
                            ? "bg-primary-gold border-primary-gold shadow-lg shadow-primary-gold/50" 
                            : "border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10"
                        )}
                      >
                        {selectedIds.has(quote.id) && (
                          <div className="w-2 h-2 rounded-full bg-primary-dark" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-primary-light">
                        <span className="md:hidden">{quote.title || quote.quoteNumber}</span>
                        <span className="hidden md:inline">{quote.quoteNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-primary-light/70 hidden md:table-cell">
                      <div className="truncate max-w-[200px]">{quote.title || '-'}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-primary-light/70 hidden sm:table-cell">
                      <div className="truncate max-w-[150px]">{quote.contactName || '-'}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-primary-light/70 hidden lg:table-cell">
                      <div className="truncate max-w-[150px]">{quote.contactCompany || '-'}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-semibold text-primary-gold">
                        {formatCurrency(quote.total)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn('px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border', statusColors[quote.status])}>
                        {quote.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default QuoteList

