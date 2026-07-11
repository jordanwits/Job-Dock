import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuoteStore } from '../store/quoteStore'
import type { Quote } from '../types/quote'
import QuoteCard from './QuoteCard'
import { quotesService } from '@/lib/api/services'
import { cn } from '@/lib/utils'
import {
  Alert,
  AlertIcon,
  AppButton,
  AppModal,
  CardsIcon,
  DocumentIcon,
  EmptyState,
  ListIcon,
  SearchIcon,
  SelectCircle,
  SelectField,
  Spinner,
  StatusBadge,
  TextField,
  TrashIcon,
} from './quotesUi'
import { QUOTE_STATUS, QUOTE_STATUS_FILTER_OPTIONS } from './quoteStatus'

interface QuoteListProps {
  onCreateClick?: () => void
}

type DisplayMode = 'cards' | 'list'

const QUOTE_STATUS_FROM_URL = ['draft', 'sent', 'accepted', 'rejected', 'expired'] as const

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

const QuoteList = ({ onCreateClick }: QuoteListProps) => {
  const [searchParams, setSearchParams] = useSearchParams()
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

  useEffect(() => {
    setStatusFilter('all')
  }, [setStatusFilter])

  useEffect(() => {
    const status = searchParams.get('status')
    if (!status) return
    if (!QUOTE_STATUS_FROM_URL.includes(status as (typeof QUOTE_STATUS_FROM_URL)[number])) return
    setStatusFilter(status as (typeof QUOTE_STATUS_FROM_URL)[number])
    const next = new URLSearchParams(searchParams)
    next.delete('status')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, setStatusFilter])

  // Persist display mode preference
  useEffect(() => {
    localStorage.setItem('quotes-display-mode', displayMode)
  }, [displayMode])

  // Clear bulk selection when the visible set changes, so "Delete selected"
  // can never act on quotes hidden by the current filter/search.
  useEffect(() => {
    setSelectedIds(new Set())
  }, [statusFilter, searchQuery])

  // Filter and search quotes
  const filteredQuotes = useMemo(() => {
    let filtered = quotes

    if (statusFilter !== 'all') {
      filtered = filtered.filter((quote) => quote.status === statusFilter)
    }

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
      <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
        <p>{error}</p>
        <button
          onClick={() => {
            clearError()
            fetchQuotes()
          }}
          className="mt-1.5 font-semibold underline-offset-2 hover:underline"
        >
          Try again
        </button>
      </Alert>
    )
  }

  return (
    <div className="space-y-5">
      {/* Search and filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <TextField
            placeholder="Search quotes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<SearchIcon className="h-4 w-4" />}
            aria-label="Search quotes"
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <div className="w-full sm:w-[150px]">
            <SelectField
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as 'all' | 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
                )
              }
              aria-label="Filter by status"
              options={QUOTE_STATUS_FILTER_OPTIONS}
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-1">
            <button
              onClick={() => setDisplayMode('cards')}
              className={cn(
                'flex h-8 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                displayMode === 'cards' ? 'bg-surface text-accent-strong shadow-card' : 'text-ink-subtle hover:text-ink'
              )}
              title="Card view"
              aria-label="Card view"
              aria-pressed={displayMode === 'cards'}
            >
              <CardsIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDisplayMode('list')}
              className={cn(
                'flex h-8 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                displayMode === 'list' ? 'bg-surface text-accent-strong shadow-card' : 'text-ink-subtle hover:text-ink'
              )}
              title="List view"
              aria-label="List view"
              aria-pressed={displayMode === 'list'}
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results count and bulk actions */}
      <div className="flex min-h-[2.25rem] items-center justify-between">
        <div className="text-sm text-ink-muted">
          {selectedIds.size > 0 ? (
            <span className="font-medium text-accent-strong">
              <span className="font-mono tabular-nums">{selectedIds.size}</span> selected
            </span>
          ) : (
            <>
              <span className="font-mono tabular-nums text-ink">{filteredQuotes.length}</span>{' '}
              {filteredQuotes.length === 1 ? 'quote' : 'quotes'}
            </>
          )}
        </div>
        {selectedIds.size > 0 && (
          <AppButton variant="dangerGhost" size="sm" onClick={() => setShowDeleteConfirm(true)}>
            <TrashIcon className="h-4 w-4" />
            Delete selected ({selectedIds.size})
          </AppButton>
        )}
      </div>

      {/* Delete confirmation */}
      <AppModal
        isOpen={showDeleteConfirm}
        onClose={() => !isDeleting && setShowDeleteConfirm(false)}
        title={`Delete ${selectedIds.size} quote${selectedIds.size !== 1 ? 's' : ''}?`}
        size="sm"
        fullScreenOnMobile={false}
        footer={
          <>
            <AppButton variant="ghost" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
              Cancel
            </AppButton>
            <AppButton variant="danger" onClick={handleBulkDelete} isLoading={isDeleting} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AppButton>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertIcon className="h-5 w-5" />
          </span>
          <p className="text-sm leading-relaxed text-ink-muted">
            This action cannot be undone. All selected quotes will be permanently removed.
          </p>
        </div>
      </AppModal>

      {/* Quote list */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-ink-muted">
          <Spinner className="text-accent-strong" />
          Loading quotes...
        </div>
      ) : filteredQuotes.length === 0 ? (
        <EmptyState
          icon={<DocumentIcon className="h-7 w-7" />}
          title={
            searchQuery || statusFilter !== 'all'
              ? 'No quotes match your filters.'
              : 'No quotes yet. Create your first one to get started.'
          }
          action={
            !searchQuery && statusFilter === 'all' && onCreateClick ? (
              <AppButton onClick={onCreateClick} className="mt-1">
                Create your first quote
              </AppButton>
            ) : undefined
          }
        />
      ) : displayMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
        <QuoteTable
          quotes={filteredQuotes}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelection}
          onToggleSelectAll={toggleSelectAll}
          onRowClick={setSelectedQuote}
        />
      )}
    </div>
  )
}

/* ── Table view ───────────────────────────────────────────────────────── */
function QuoteTable({
  quotes,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onRowClick,
}: {
  quotes: Quote[]
  selectedIds: Set<string>
  onToggleSelect: (id: string, event: React.MouseEvent) => void
  onToggleSelectAll: () => void
  onRowClick: (quote: Quote) => void
}) {
  const allSelected = selectedIds.size === quotes.length && quotes.length > 0
  const thCls = 'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle'
  return (
    <div className="overflow-hidden rounded-xl bg-surface shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              <th className="w-12 px-4 py-3">
                <SelectCircle
                  selected={allSelected}
                  onClick={(e) => { e.stopPropagation(); onToggleSelectAll() }}
                  label="Select all"
                  className="mx-auto"
                />
              </th>
              <th className={thCls}>Quote #</th>
              <th className={cn(thCls, 'hidden md:table-cell')}>Title</th>
              <th className={cn(thCls, 'hidden sm:table-cell')}>Contact</th>
              <th className={cn(thCls, 'hidden lg:table-cell')}>Company</th>
              <th className={cn(thCls, 'text-right')}>Total</th>
              <th className={thCls}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {quotes.map((quote) => {
              const status = QUOTE_STATUS[quote.status] ?? QUOTE_STATUS.draft
              return (
                <tr
                  key={quote.id}
                  className="cursor-pointer bg-surface transition-colors hover:bg-surface-hover"
                  onClick={() => onRowClick(quote)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <SelectCircle
                      selected={selectedIds.has(quote.id)}
                      onClick={(e) => onToggleSelect(quote.id, e)}
                      className="mx-auto"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-mono text-sm font-medium tabular-nums text-ink md:font-normal">
                      <span className="md:hidden">{quote.title || quote.quoteNumber}</span>
                      <span className="hidden md:inline">{quote.quoteNumber}</span>
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-ink-muted md:table-cell">
                    <div className="max-w-[200px] truncate">{quote.title || <span className="text-ink-subtle">—</span>}</div>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-ink-muted sm:table-cell">
                    <div className="max-w-[150px] truncate">{quote.contactName || <span className="text-ink-subtle">—</span>}</div>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-ink-muted lg:table-cell">
                    <div className="max-w-[150px] truncate">{quote.contactCompany || <span className="text-ink-subtle">—</span>}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                      {formatCurrency(quote.total)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default QuoteList
