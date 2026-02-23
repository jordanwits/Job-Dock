import { useEffect, useMemo, useState } from 'react'
import { useInvoiceStore } from '../store/invoiceStore'
import InvoiceCard from './InvoiceCard'
import { Input, Button, Select, Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import { invoicesService } from '@/lib/api/services'
import type { Quote } from '@/features/quotes/types/quote'
import ConvertQuoteToInvoiceModal from '@/features/quotes/components/ConvertQuoteToInvoiceModal'
import { useQuoteStore } from '@/features/quotes/store/quoteStore'
import { useTheme } from '@/contexts/ThemeContext'

interface InvoiceListProps {
  onCreateClick?: () => void
}

type DisplayMode = 'cards' | 'list'

const InvoiceList = ({ onCreateClick }: InvoiceListProps) => {
  const { theme } = useTheme()
  const {
    invoices,
    isLoading,
    error,
    searchQuery,
    statusFilter,
    paymentStatusFilter,
    fetchInvoices,
    setSearchQuery,
    setStatusFilter,
    setPaymentStatusFilter,
    clearError,
    setSelectedInvoice,
    deleteInvoice,
    convertQuoteToInvoice,
  } = useInvoiceStore()
  const { updateQuote } = useQuoteStore()

  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    const saved = localStorage.getItem('invoices-display-mode')
    return (saved as DisplayMode) || 'cards'
  })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [unconvertedQuotes, setUnconvertedQuotes] = useState<Quote[]>([])
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false)
  const [selectedQuoteForConversion, setSelectedQuoteForConversion] = useState<Quote | null>(null)
  const [isConverting, setIsConverting] = useState(false)

  useEffect(() => {
    fetchInvoices()
    fetchUnconvertedQuotes()
  }, [fetchInvoices])

  const fetchUnconvertedQuotes = async () => {
    setIsLoadingQuotes(true)
    try {
      const quotes = await invoicesService.getUnconvertedAcceptedQuotes()
      console.log('Fetched unconverted quotes:', quotes)
      setUnconvertedQuotes(quotes || [])
    } catch (error: any) {
      console.error('Failed to fetch unconverted quotes:', error)
      console.error('Error details:', error.response?.data || error.message)
      setUnconvertedQuotes([])
    } finally {
      setIsLoadingQuotes(false)
    }
  }

  // Persist display mode preference
  useEffect(() => {
    localStorage.setItem('invoices-display-mode', displayMode)
  }, [displayMode])

  // Filter and search invoices
  const filteredInvoices = useMemo(() => {
    let filtered = invoices

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.status === statusFilter)
    }

    // Filter by payment status
    if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.paymentStatus === paymentStatusFilter)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        invoice =>
          invoice.invoiceNumber.toLowerCase().includes(query) ||
          invoice.title?.toLowerCase().includes(query) ||
          invoice.contactName?.toLowerCase().includes(query) ||
          invoice.contactCompany?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [invoices, statusFilter, paymentStatusFilter, searchQuery])

  // Check if any invoices have tracking enabled to show columns
  const hasAnyTrackResponse = filteredInvoices.some(inv => inv.trackResponse !== false)
  const hasAnyTrackPayment = filteredInvoices.some(inv => inv.trackPayment !== false)

  // Handle bulk delete
  const handleBulkDelete = async () => {
    try {
      setIsDeleting(true)
      const idsToDelete = Array.from(selectedIds)
      const errors: string[] = []

      // Delete invoices in batches of 5 to balance speed and reliability
      const BATCH_SIZE = 5
      for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
        const batch = idsToDelete.slice(i, i + BATCH_SIZE)
        const results = await Promise.allSettled(
          // Call API directly to avoid UI updates during deletion
          batch.map(id => invoicesService.delete(id))
        )

        // Track which ones failed
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const failedId = batch[index]
            console.error(`Failed to delete invoice ${failedId}:`, result.reason)
            errors.push(failedId)
          }
        })
      }

      // Refresh the entire list once at the end to prevent flashing
      await fetchInvoices()

      // Only clear successfully deleted invoices
      if (errors.length > 0) {
        setSelectedIds(new Set(errors))
        alert(
          `${idsToDelete.length - errors.length} invoice(s) deleted successfully. ${errors.length} invoice(s) failed - they remain selected for retry.`
        )
      } else {
        setSelectedIds(new Set())
      }
      setShowDeleteConfirm(false)
    } catch (error) {
      console.error('Error deleting invoices:', error)
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
    if (selectedIds.size === filteredInvoices.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredInvoices.map(i => i.id)))
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
            fetchInvoices()
          }}
          className="mt-2"
        >
          Try Again
        </Button>
      </div>
    )
  }

  const paymentStatusColors = {
    pending: theme === 'dark'
      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      : 'bg-yellow-100 text-yellow-700 border-yellow-300',
    partial: theme === 'dark'
      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      : 'bg-blue-100 text-blue-700 border-blue-300',
    paid: theme === 'dark'
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : 'bg-green-100 text-green-700 border-green-300',
  }

  const paymentStatusLabels = {
    pending: 'Unpaid',
    partial: 'Partial',
    paid: 'Paid',
  }

  const approvalStatusColors = {
    none: theme === 'dark'
      ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      : 'bg-gray-200 text-gray-600 border-gray-300',
    accepted: theme === 'dark'
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : 'bg-green-100 text-green-700 border-green-300',
    declined: theme === 'dark'
      ? 'bg-red-500/20 text-red-400 border-red-500/30'
      : 'bg-red-100 text-red-700 border-red-300',
  }

  const approvalStatusLabels = {
    none: 'No Response',
    accepted: 'Accepted',
    declined: 'Declined',
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const handleConvertQuote = async (options: { paymentTerms: string; dueDate: string }) => {
    if (!selectedQuoteForConversion) return

    setIsConverting(true)
    try {
      const invoice = await convertQuoteToInvoice(selectedQuoteForConversion, options)
      // Update quote status to accepted (if not already)
      await updateQuote({ id: selectedQuoteForConversion.id, status: 'accepted' })
      setSelectedQuoteForConversion(null)
      // Refresh both invoices and quotes
      await fetchInvoices()
      await fetchUnconvertedQuotes()
      // Set the newly created invoice as selected
      setSelectedInvoice(invoice)
    } catch (error) {
      // Error handled by store
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* To Be Invoiced Section - Only show if there are quotes */}
      {!isLoadingQuotes && unconvertedQuotes.length > 0 && (
        <div className={cn(
          "border-b p-4",
          theme === 'dark' ? 'border-white/10' : 'border-gray-200'
        )}>
          <h3 className="text-sm font-semibold text-primary-gold mb-3">
            To Be Invoiced ({unconvertedQuotes.length})
          </h3>
          <div className="flex gap-2 flex-wrap">
            {unconvertedQuotes.map(quote => (
              <div
                key={quote.id}
                onClick={() => setSelectedQuoteForConversion(quote)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 ring-1 ring-amber-500/10 text-amber-400 text-sm cursor-pointer hover:bg-amber-500/20 hover:ring-amber-500/20 transition-all"
                title="Click to convert to invoice"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="font-medium">{quote.quoteNumber}</span>
                {quote.contactName && (
                  <span className="text-amber-400/70">• {quote.contactName}</span>
                )}
                <span className="text-amber-400/70">• {formatCurrency(quote.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <Select
            value={statusFilter}
            onChange={e =>
              setStatusFilter(e.target.value as 'all' | 'draft' | 'sent' | 'overdue' | 'cancelled')
            }
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'draft', label: 'Draft' },
              { value: 'sent', label: 'Sent' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            className="w-full sm:w-auto min-w-[140px]"
          />
          <Select
            value={paymentStatusFilter}
            onChange={e =>
              setPaymentStatusFilter(e.target.value as 'all' | 'pending' | 'partial' | 'paid')
            }
            options={[
              { value: 'all', label: 'All Payments' },
              { value: 'pending', label: 'Unpaid' },
              { value: 'partial', label: 'Partial' },
              { value: 'paid', label: 'Paid' },
            ]}
            className="w-full sm:w-auto min-w-[140px]"
          />
          <div className={cn(
            "flex gap-1 border rounded-lg p-1",
            theme === 'dark' ? 'border-primary-blue' : 'border-gray-300'
          )}>
            <button
              onClick={() => setDisplayMode('cards')}
              className={cn(
                "px-3 py-1.5 rounded text-sm font-medium transition-colors",
                displayMode === 'cards'
                  ? 'bg-primary-gold text-primary-dark'
                  : theme === 'dark'
                    ? 'text-primary-light hover:bg-primary-blue/20'
                    : 'text-primary-lightText hover:bg-gray-100'
              )}
              title="Card View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </button>
            <button
              onClick={() => setDisplayMode('list')}
              className={cn(
                "px-3 py-1.5 rounded text-sm font-medium transition-colors",
                displayMode === 'list'
                  ? 'bg-primary-gold text-primary-dark'
                  : theme === 'dark'
                    ? 'text-primary-light hover:bg-primary-blue/20'
                    : 'text-primary-lightText hover:bg-gray-100'
              )}
              title="List View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Results Count and Bulk Actions */}
      <div className="flex items-center justify-between">
        <div className={cn(
          "text-sm",
          theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
        )}>
          {selectedIds.size > 0 ? (
            <span className="font-medium text-primary-gold">{selectedIds.size} selected</span>
          ) : (
            `${filteredInvoices.length} invoice${filteredInvoices.length !== 1 ? 's' : ''} found`
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete Selected ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className={cn(
              "border border-red-500/30 rounded-lg p-6 max-w-md w-full mx-4",
              theme === 'dark' ? 'bg-primary-dark' : 'bg-white'
            )}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-red-400 mb-2">
                  Delete {selectedIds.size} Invoice{selectedIds.size !== 1 ? 's' : ''}?
                </h3>
                <p className={cn(
                  "text-sm mb-4",
                  theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                )}>
                  This action cannot be undone. All selected invoices will be permanently removed.
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

      {/* Invoice List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className={cn(
            theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
          )}>Loading invoices...</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="text-center py-12">
          <p className={cn(
            "mb-4",
            theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
          )}>
            {searchQuery || statusFilter !== 'all' || paymentStatusFilter !== 'all'
              ? 'No invoices match your filters'
              : 'No invoices yet'}
          </p>
          {!searchQuery &&
            statusFilter === 'all' &&
            paymentStatusFilter === 'all' &&
            onCreateClick && (
              <Button variant="primary" onClick={onCreateClick}>
                Create Your First Invoice
              </Button>
            )}
        </div>
      ) : displayMode === 'cards' ? (
        // Card Grid Layout
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInvoices.map(invoice => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              isSelected={selectedIds.has(invoice.id)}
              onToggleSelect={toggleSelection}
            />
          ))}
        </div>
      ) : (
        // List Layout
        <>
          {/* Desktop Table View */}
          <div className={cn(
            "hidden sm:block rounded-lg overflow-hidden",
            theme === 'dark'
              ? 'border border-white/10'
              : 'border border-gray-200'
          )}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={cn(
                  "border-b",
                  theme === 'dark'
                    ? "bg-primary-dark-secondary border-primary-blue"
                    : "bg-gray-50 border-gray-200"
                )}>
                  <tr>
                    <th className="px-4 py-3 w-12">
                      <div
                        onClick={toggleSelectAll}
                        className={cn(
                          'w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center mx-auto',
                          selectedIds.size === filteredInvoices.length &&
                            filteredInvoices.length > 0
                            ? 'bg-primary-gold border-primary-gold shadow-lg shadow-primary-gold/50'
                            : theme === 'dark'
                              ? 'border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10'
                              : 'border-gray-400 bg-white hover:border-primary-gold/50 hover:bg-primary-gold/10'
                        )}
                      >
                        {selectedIds.size === filteredInvoices.length &&
                          filteredInvoices.length > 0 && (
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              theme === 'dark' ? 'bg-primary-dark' : 'bg-white'
                            )} />
                          )}
                      </div>
                    </th>
                    <th className={cn(
                      "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                      theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                    )}>
                      Invoice #
                    </th>
                    <th className={cn(
                      "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider hidden md:table-cell",
                      theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                    )}>
                      Title
                    </th>
                    <th className={cn(
                      "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                      theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                    )}>
                      Contact
                    </th>
                    <th className={cn(
                      "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider hidden lg:table-cell",
                      theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                    )}>
                      Due Date
                    </th>
                    <th className={cn(
                      "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                      theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                    )}>
                      Total
                    </th>
                    {hasAnyTrackResponse && (
                      <th className={cn(
                        "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                        theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                      )}>
                        Response
                      </th>
                    )}
                    {hasAnyTrackPayment && (
                      <th className={cn(
                        "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                        theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                      )}>
                        Payment
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className={cn(
                  "divide-y",
                  theme === 'dark' ? 'divide-primary-blue' : 'divide-gray-200'
                )}>
                  {filteredInvoices.map(invoice => {
                    const isOverdue =
                      invoice.dueDate &&
                      invoice.paymentStatus !== 'paid' &&
                      (() => {
                        const dueDate = new Date(invoice.dueDate)
                        const oneDayAgo = new Date()
                        oneDayAgo.setDate(oneDayAgo.getDate() - 1)
                        oneDayAgo.setHours(23, 59, 59, 999)
                        return dueDate < oneDayAgo
                      })()

                    return (
                      <tr
                        key={invoice.id}
                        className={cn(
                          "transition-colors cursor-pointer",
                          theme === 'dark'
                            ? "bg-primary-dark hover:bg-primary-dark/50"
                            : "bg-white hover:bg-gray-50"
                        )}
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div
                            onClick={e => toggleSelection(invoice.id, e)}
                            className={cn(
                              'w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center mx-auto',
                              selectedIds.has(invoice.id)
                                ? 'bg-primary-gold border-primary-gold shadow-lg shadow-primary-gold/50'
                                : theme === 'dark'
                                  ? 'border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10'
                                  : 'border-gray-400 bg-white hover:border-primary-gold/50 hover:bg-primary-gold/10'
                            )}
                          >
                            {selectedIds.has(invoice.id) && (
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                theme === 'dark' ? 'bg-primary-dark' : 'bg-white'
                              )} />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className={cn(
                            "text-sm font-medium",
                            theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                          )}>
                            <span className="sm:hidden">
                              {invoice.title || invoice.invoiceNumber}
                            </span>
                            <span className="hidden sm:inline">{invoice.invoiceNumber}</span>
                          </div>
                        </td>
                        <td className={cn(
                          "px-4 py-3 whitespace-nowrap text-sm hidden md:table-cell",
                          theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                        )}>
                          <div className="truncate max-w-[200px]">{invoice.title || '-'}</div>
                        </td>
                        <td className={cn(
                          "px-4 py-3 whitespace-nowrap text-sm",
                          theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                        )}>
                          <div className="truncate max-w-[150px]">{invoice.contactName || '-'}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm hidden lg:table-cell">
                          {invoice.dueDate ? (
                            <div
                              className={cn(
                                isOverdue ? 'text-red-400 font-medium' : theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                              )}
                            >
                              {isOverdue ? '⚠️ ' : ''}
                              {new Date(invoice.dueDate).toLocaleDateString()}
                            </div>
                          ) : (
                            <span className={cn(
                              theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary/70'
                            )}>-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-semibold text-primary-gold">
                            {formatCurrency(invoice.total)}
                          </div>
                          {invoice.trackPayment !== false && invoice.paymentStatus === 'partial' && (
                            <div className={cn(
                              "text-xs",
                              theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary/70'
                            )}>
                              Paid: {formatCurrency(invoice.paidAmount)}
                            </div>
                          )}
                        </td>
                        {hasAnyTrackResponse && (
                          <td className="px-4 py-3 whitespace-nowrap">
                            {invoice.trackResponse !== false && invoice.approvalStatus && (
                              <span
                                className={cn(
                                  'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border',
                                  approvalStatusColors[invoice.approvalStatus]
                                )}
                              >
                                {approvalStatusLabels[invoice.approvalStatus]}
                              </span>
                            )}
                          </td>
                        )}
                        {hasAnyTrackPayment && (
                          <td className="px-4 py-3 whitespace-nowrap">
                            {invoice.trackPayment !== false && (
                              <span
                                className={cn(
                                  'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border',
                                  paymentStatusColors[invoice.paymentStatus]
                                )}
                              >
                                {paymentStatusLabels[invoice.paymentStatus]}
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile List View */}
          <div className="sm:hidden space-y-3">
            {filteredInvoices.map(invoice => {
              const isOverdue =
                invoice.dueDate &&
                invoice.paymentStatus !== 'paid' &&
                (() => {
                  const dueDate = new Date(invoice.dueDate)
                  const oneDayAgo = new Date()
                  oneDayAgo.setDate(oneDayAgo.getDate() - 1)
                  oneDayAgo.setHours(23, 59, 59, 999)
                  return dueDate < oneDayAgo
                })()

              return (
                <div
                  key={invoice.id}
                  onClick={() => setSelectedInvoice(invoice)}
                  className={cn(
                    "rounded-lg border p-4 space-y-3 cursor-pointer transition-colors",
                    theme === 'dark'
                      ? 'border-primary-blue bg-primary-dark hover:bg-primary-dark/50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  )}
                >
                  {/* Header with Selection and Number */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        onClick={e => toggleSelection(invoice.id, e)}
                        className={cn(
                          'w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center flex-shrink-0',
                          selectedIds.has(invoice.id)
                            ? 'bg-primary-gold border-primary-gold shadow-lg shadow-primary-gold/50'
                            : theme === 'dark'
                              ? 'border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10'
                              : 'border-gray-400 bg-white hover:border-primary-gold/50 hover:bg-primary-gold/10'
                        )}
                      >
                        {selectedIds.has(invoice.id) && (
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            theme === 'dark' ? 'bg-primary-dark' : 'bg-white'
                          )} />
                        )}
                      </div>
                      <div className={cn(
                        "text-sm font-semibold",
                        theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                      )}>
                        {invoice.title || invoice.invoiceNumber}
                      </div>
                    </div>
                    <div className="text-lg font-bold text-primary-gold">
                      {formatCurrency(invoice.total)}
                    </div>
                  </div>

                  {/* Contact, Due Date, and Status on same row */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    {/* Contact Name */}
                    <div className={cn(
                      "text-sm truncate flex-shrink min-w-0",
                      theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                    )}>
                      {invoice.contactName || '-'}
                    </div>

                    {/* Due Date and Status */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {invoice.dueDate && (
                        <div
                          className={cn(
                            'text-xs whitespace-nowrap',
                            isOverdue ? 'text-red-400 font-medium' : theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary/70'
                          )}
                        >
                          {isOverdue ? '⚠️ ' : ''}
                          {new Date(invoice.dueDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      )}
                      {invoice.trackResponse !== false && invoice.approvalStatus && (
                        <span
                          className={cn(
                            'px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border',
                            approvalStatusColors[invoice.approvalStatus]
                          )}
                        >
                          {approvalStatusLabels[invoice.approvalStatus]}
                        </span>
                      )}
                      {invoice.trackPayment !== false && (
                        <span
                          className={cn(
                            'px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border',
                            paymentStatusColors[invoice.paymentStatus]
                          )}
                        >
                          {paymentStatusLabels[invoice.paymentStatus]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Partial Payment Info */}
                  {invoice.trackPayment !== false && invoice.paymentStatus === 'partial' && (
                    <div className={cn(
                      "text-xs pt-2 border-t",
                      theme === 'dark'
                        ? 'text-primary-light/50 border-primary-blue'
                        : 'text-primary-lightTextSecondary/70 border-gray-200'
                    )}>
                      Paid: {formatCurrency(invoice.paidAmount)} of {formatCurrency(invoice.total)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Convert Quote to Invoice Modal */}
      {selectedQuoteForConversion && (
        <ConvertQuoteToInvoiceModal
          quote={selectedQuoteForConversion}
          isOpen={!!selectedQuoteForConversion}
          onClose={() => setSelectedQuoteForConversion(null)}
          onConvert={handleConvertQuote}
          isLoading={isConverting}
        />
      )}
    </div>
  )
}

export default InvoiceList
