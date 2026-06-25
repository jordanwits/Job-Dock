import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useInvoiceStore } from '../store/invoiceStore'
import type { Invoice } from '../types/invoice'
import InvoiceCard from './InvoiceCard'
import { cn } from '@/lib/utils'
import { invoicesService } from '@/lib/api/services'
import type { Quote } from '@/features/quotes/types/quote'
import ConvertQuoteToInvoiceModal from '@/features/quotes/components/ConvertQuoteToInvoiceModal'
import { useQuoteStore } from '@/features/quotes/store/quoteStore'
import {
  Alert,
  AlertIcon,
  AppButton,
  AppModal,
  CardsIcon,
  DocumentIcon,
  EmptyState,
  ListIcon,
  ReceiptIcon,
  SearchIcon,
  SelectCircle,
  SelectField,
  Spinner,
  StatusBadge,
  TextField,
  TrashIcon,
} from './invoicesUi'
import {
  INVOICE_STATUS_FILTER_OPTIONS,
  PAYMENT_STATUS,
  PAYMENT_STATUS_FILTER_OPTIONS,
} from './invoiceStatus'

interface InvoiceListProps {
  onCreateClick?: () => void
}

type DisplayMode = 'cards' | 'list'

const INVOICE_STATUS_FROM_URL = ['draft', 'sent', 'overdue', 'cancelled'] as const

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

// Overdue if due date is more than 1 day in the past and not fully paid.
const isInvoiceOverdue = (invoice: Invoice) =>
  !!invoice.dueDate &&
  invoice.paymentStatus !== 'paid' &&
  (() => {
    const dueDate = new Date(invoice.dueDate)
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)
    oneDayAgo.setHours(23, 59, 59, 999)
    return dueDate < oneDayAgo
  })()

const InvoiceList = ({ onCreateClick }: InvoiceListProps) => {
  const [searchParams, setSearchParams] = useSearchParams()
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
    convertQuoteToInvoice,
  } = useInvoiceStore()
  const { deleteQuote } = useQuoteStore()

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

  useEffect(() => {
    setStatusFilter('all')
  }, [setStatusFilter])

  useEffect(() => {
    const status = searchParams.get('status')
    if (!status) return
    if (!INVOICE_STATUS_FROM_URL.includes(status as (typeof INVOICE_STATUS_FROM_URL)[number]))
      return
    setStatusFilter(status as (typeof INVOICE_STATUS_FROM_URL)[number])
    const next = new URLSearchParams(searchParams)
    next.delete('status')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, setStatusFilter])

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

  // Check if any invoices have payment tracking enabled to show the payment column
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

  const handleConvertQuote = async (options: { paymentTerms: string; dueDate: string }) => {
    if (!selectedQuoteForConversion) return

    setIsConverting(true)
    try {
      const invoice = await convertQuoteToInvoice(selectedQuoteForConversion, options)
      await deleteQuote(selectedQuoteForConversion.id)
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

  if (error) {
    return (
      <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
        <p>{error}</p>
        <button
          onClick={() => {
            clearError()
            fetchInvoices()
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
      {/* To Be Invoiced — accepted quotes awaiting conversion */}
      {!isLoadingQuotes && unconvertedQuotes.length > 0 && (
        <div className="rounded-xl bg-surface p-4 shadow-card">
          <h3 className="mb-3 text-sm font-semibold text-ink">
            To Be Invoiced{' '}
            <span className="font-mono tabular-nums text-ink-muted">({unconvertedQuotes.length})</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {unconvertedQuotes.map(quote => (
              <button
                key={quote.id}
                type="button"
                onClick={() => setSelectedQuoteForConversion(quote)}
                className="inline-flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-strong transition-colors hover:bg-accent-soft hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                title="Click to convert to invoice"
              >
                <ReceiptIcon className="h-4 w-4 shrink-0" />
                <span className="font-mono font-medium tabular-nums">{quote.quoteNumber}</span>
                {quote.contactName && <span className="opacity-70">· {quote.contactName}</span>}
                <span className="font-mono tabular-nums opacity-70">· {formatCurrency(quote.total)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search and filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <TextField
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            leftIcon={<SearchIcon className="h-4 w-4" />}
            aria-label="Search invoices"
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <div className="w-full sm:w-[150px]">
            <SelectField
              value={statusFilter}
              onChange={e =>
                setStatusFilter(e.target.value as 'all' | 'draft' | 'sent' | 'overdue' | 'cancelled')
              }
              aria-label="Filter by status"
              options={INVOICE_STATUS_FILTER_OPTIONS}
            />
          </div>
          <div className="w-full sm:w-[150px]">
            <SelectField
              value={paymentStatusFilter}
              onChange={e =>
                setPaymentStatusFilter(e.target.value as 'all' | 'pending' | 'partial' | 'paid')
              }
              aria-label="Filter by payment status"
              options={PAYMENT_STATUS_FILTER_OPTIONS}
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
              <span className="font-mono tabular-nums text-ink">{filteredInvoices.length}</span>{' '}
              {filteredInvoices.length === 1 ? 'invoice' : 'invoices'}
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
        title={`Delete ${selectedIds.size} invoice${selectedIds.size !== 1 ? 's' : ''}?`}
        size="sm"
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
            This action cannot be undone. All selected invoices will be permanently removed.
          </p>
        </div>
      </AppModal>

      {/* Invoice list */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-ink-muted">
          <Spinner className="text-accent-strong" />
          Loading invoices...
        </div>
      ) : filteredInvoices.length === 0 ? (
        <EmptyState
          icon={<DocumentIcon className="h-7 w-7" />}
          title={
            searchQuery || statusFilter !== 'all' || paymentStatusFilter !== 'all'
              ? 'No invoices match your filters.'
              : 'No invoices yet. Create your first one to get started.'
          }
          action={
            !searchQuery && statusFilter === 'all' && paymentStatusFilter === 'all' && onCreateClick ? (
              <AppButton onClick={onCreateClick} className="mt-1">
                Create your first invoice
              </AppButton>
            ) : undefined
          }
        />
      ) : displayMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
        <InvoiceTable
          invoices={filteredInvoices}
          selectedIds={selectedIds}
          hasAnyTrackPayment={hasAnyTrackPayment}
          onToggleSelect={toggleSelection}
          onToggleSelectAll={toggleSelectAll}
          onRowClick={setSelectedInvoice}
        />
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

/* ── Table view ───────────────────────────────────────────────────────── */
function InvoiceTable({
  invoices,
  selectedIds,
  hasAnyTrackPayment,
  onToggleSelect,
  onToggleSelectAll,
  onRowClick,
}: {
  invoices: Invoice[]
  selectedIds: Set<string>
  hasAnyTrackPayment: boolean
  onToggleSelect: (id: string, event: React.MouseEvent) => void
  onToggleSelectAll: () => void
  onRowClick: (invoice: Invoice) => void
}) {
  const allSelected = selectedIds.size === invoices.length && invoices.length > 0
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
                  onClick={e => { e.stopPropagation(); onToggleSelectAll() }}
                  label="Select all"
                  className="mx-auto"
                />
              </th>
              <th className={thCls}>Invoice #</th>
              <th className={cn(thCls, 'hidden md:table-cell')}>Title</th>
              <th className={cn(thCls, 'hidden sm:table-cell')}>Contact</th>
              <th className={cn(thCls, 'hidden lg:table-cell')}>Due date</th>
              <th className={cn(thCls, 'text-right')}>Total</th>
              {hasAnyTrackPayment && <th className={thCls}>Payment</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {invoices.map(invoice => {
              const isOverdue = isInvoiceOverdue(invoice)
              const payment = PAYMENT_STATUS[invoice.paymentStatus] ?? PAYMENT_STATUS.pending
              return (
                <tr
                  key={invoice.id}
                  className="cursor-pointer bg-surface transition-colors hover:bg-surface-hover"
                  onClick={() => onRowClick(invoice)}
                >
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <SelectCircle
                      selected={selectedIds.has(invoice.id)}
                      onClick={e => onToggleSelect(invoice.id, e)}
                      className="mx-auto"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-mono text-sm font-medium tabular-nums text-ink md:font-normal">
                      <span className="md:hidden">{invoice.title || invoice.invoiceNumber}</span>
                      <span className="hidden md:inline">{invoice.invoiceNumber}</span>
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-ink-muted md:table-cell">
                    <div className="max-w-[200px] truncate">{invoice.title || <span className="text-ink-subtle">—</span>}</div>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-ink-muted sm:table-cell">
                    <div className="max-w-[150px] truncate">{invoice.contactName || <span className="text-ink-subtle">—</span>}</div>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-sm lg:table-cell">
                    {invoice.dueDate ? (
                      <span className={cn('font-mono tabular-nums', isOverdue ? 'font-medium text-danger' : 'text-ink-muted')}>
                        {new Date(invoice.dueDate).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-ink-subtle">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                      {formatCurrency(invoice.total)}
                    </span>
                    {invoice.trackPayment !== false && invoice.paymentStatus === 'partial' && (
                      <span className="mt-0.5 block text-[12px] text-ink-subtle">
                        Paid <span className="font-mono tabular-nums">{formatCurrency(invoice.paidAmount)}</span>
                      </span>
                    )}
                  </td>
                  {hasAnyTrackPayment && (
                    <td className="whitespace-nowrap px-4 py-3">
                      {invoice.trackPayment !== false && (
                        <StatusBadge tone={payment.tone}>{payment.label}</StatusBadge>
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
  )
}

export default InvoiceList
