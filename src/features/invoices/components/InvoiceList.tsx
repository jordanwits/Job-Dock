import { useEffect, useMemo } from 'react'
import { useInvoiceStore } from '../store/invoiceStore'
import InvoiceCard from './InvoiceCard'
import { Input, Button, Select } from '@/components/ui'

const InvoiceList = () => {
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
  } = useInvoiceStore()

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  // Filter and search invoices
  const filteredInvoices = useMemo(() => {
    let filtered = invoices

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((invoice) => invoice.status === statusFilter)
    }

    // Filter by payment status
    if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter((invoice) => invoice.paymentStatus === paymentStatusFilter)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (invoice) =>
          invoice.invoiceNumber.toLowerCase().includes(query) ||
          invoice.contactName?.toLowerCase().includes(query) ||
          invoice.contactCompany?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [invoices, statusFilter, paymentStatusFilter, searchQuery])

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

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as 'all' | 'draft' | 'sent' | 'overdue' | 'cancelled'
              )
            }
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'draft', label: 'Draft' },
              { value: 'sent', label: 'Sent' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            className="min-w-[140px]"
          />
          <Select
            value={paymentStatusFilter}
            onChange={(e) =>
              setPaymentStatusFilter(
                e.target.value as 'all' | 'pending' | 'partial' | 'paid'
              )
            }
            options={[
              { value: 'all', label: 'All Payments' },
              { value: 'pending', label: 'Pending' },
              { value: 'partial', label: 'Partial' },
              { value: 'paid', label: 'Paid' },
            ]}
            className="min-w-[140px]"
          />
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-primary-light/70">
        {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''} found
      </div>

      {/* Invoice List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-primary-light/70">Loading invoices...</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-primary-light/70 mb-4">
            {searchQuery || statusFilter !== 'all' || paymentStatusFilter !== 'all'
              ? 'No invoices match your filters'
              : 'No invoices yet'}
          </p>
          {!searchQuery && statusFilter === 'all' && paymentStatusFilter === 'all' && (
            <Button variant="primary">Create Your First Invoice</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInvoices.map((invoice) => (
            <InvoiceCard key={invoice.id} invoice={invoice} />
          ))}
        </div>
      )}
    </div>
  )
}

export default InvoiceList

