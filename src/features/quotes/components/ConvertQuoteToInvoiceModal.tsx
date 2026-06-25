import { useState, useEffect } from 'react'
import { Quote } from '../types/quote'
import { AppButton, AppModal, DateField, SelectField } from './quotesUi'

interface ConvertQuoteToInvoiceModalProps {
  quote: Quote
  isOpen: boolean
  onClose: () => void
  onConvert: (options: { paymentTerms: string; dueDate: string }) => Promise<void>
  isLoading?: boolean
}

type PaymentTermOption = 'Net 15' | 'Net 30' | 'Net 45' | 'Net 60' | 'Due on Receipt' | 'Custom'

const currency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value)

const ConvertQuoteToInvoiceModal = ({
  quote,
  isOpen,
  onClose,
  onConvert,
  isLoading,
}: ConvertQuoteToInvoiceModalProps) => {
  const [selectedTerm, setSelectedTerm] = useState<PaymentTermOption>('Net 30')
  const [customDate, setCustomDate] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('Net 30')
  const [dueDate, setDueDate] = useState('')

  // Calculate due date based on payment terms
  const calculateDueDate = (term: PaymentTermOption, custom?: string): string => {
    if (term === 'Custom' && custom) {
      return custom
    }

    const date = new Date()
    switch (term) {
      case 'Net 15':
        date.setDate(date.getDate() + 15)
        break
      case 'Net 30':
        date.setDate(date.getDate() + 30)
        break
      case 'Net 45':
        date.setDate(date.getDate() + 45)
        break
      case 'Net 60':
        date.setDate(date.getDate() + 60)
        break
      case 'Due on Receipt':
        // Due today
        break
      case 'Custom':
        if (custom) {
          return custom
        }
        // Default to 30 days if custom selected but no date chosen
        date.setDate(date.getDate() + 30)
        break
    }
    return date.toISOString().split('T')[0]
  }

  // Update due date when payment term changes
  useEffect(() => {
    if (selectedTerm === 'Custom') {
      if (customDate) {
        setDueDate(customDate)
        setPaymentTerms('Custom')
      } else {
        // Don't set due date until custom date is selected
        setDueDate('')
      }
    } else {
      const calculatedDate = calculateDueDate(selectedTerm)
      setDueDate(calculatedDate)
      setPaymentTerms(selectedTerm)
      setCustomDate('') // Clear custom date when not using custom option
    }
  }, [selectedTerm, customDate])

  // Handle custom date selection
  const handleCustomDateChange = (date: string) => {
    setCustomDate(date)
    if (date) {
      setDueDate(date)
      setPaymentTerms('Custom')
    }
  }

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedTerm('Net 30')
      setCustomDate('')
      setPaymentTerms('Net 30')
      setDueDate('')
    }
  }, [isOpen])

  const handleConvert = async () => {
    if (selectedTerm === 'Custom' && !customDate) {
      // Don't allow conversion without a custom date
      return
    }
    const { dateStringToISO } = await import('@/lib/utils/dateUtils')
    const finalDueDate = dueDate || calculateDueDate('Net 30')
    // Convert to ISO at noon UTC to avoid timezone shifts
    const dueDateISO = dateStringToISO(finalDueDate)
    await onConvert({ paymentTerms, dueDate: dueDateISO || finalDueDate })
  }

  const taxAmount = Number(quote.taxAmount) || Number(quote.subtotal) * Number(quote.taxRate) || 0

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Convert ${quote.quoteNumber} to invoice`}
      footer={
        <>
          <AppButton variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </AppButton>
          <AppButton
            onClick={handleConvert}
            disabled={isLoading || (selectedTerm === 'Custom' && !customDate)}
            isLoading={isLoading}
          >
            {isLoading ? 'Converting...' : 'Convert to invoice'}
          </AppButton>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-ink-muted">
          This will create a new invoice based on the quote. You can customize the payment terms and due date below.
        </p>

        {/* Quote summary */}
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <div className="space-y-3 text-sm">
            {quote.lineItems && quote.lineItems.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Line items</div>
                <div className="space-y-1.5">
                  {quote.lineItems.map((item, i) => (
                    <div key={item.id || i} className="flex justify-between gap-4 text-[13px] text-ink">
                      <span className="min-w-0 flex-1 truncate">
                        {item.description ?? '-'}
                        <span className="ml-1 text-ink-subtle">
                          (<span className="font-mono tabular-nums">{Number(item.quantity) || 0}</span> ×{' '}
                          <span className="font-mono tabular-nums">{currency(Number(item.unitPrice) || 0)}</span>)
                        </span>
                      </span>
                      {item.total != null && !isNaN(Number(item.total)) && (
                        <span className="shrink-0 font-mono font-medium tabular-nums">{currency(Number(item.total))}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {quote.subtotal != null && !isNaN(Number(quote.subtotal)) && (
              <div className="flex justify-between">
                <span className="text-ink-muted">Subtotal</span>
                <span className="font-mono tabular-nums text-ink">{currency(Number(quote.subtotal))}</span>
              </div>
            )}
            {quote.taxRate != null && Number(quote.taxRate) > 0 && (
              <div className="flex justify-between">
                <span className="text-ink-muted">Tax ({(Number(quote.taxRate) * 100).toFixed(1)}%)</span>
                <span className="font-mono tabular-nums text-ink">{currency(taxAmount)}</span>
              </div>
            )}
            {quote.discount != null && Number(quote.discount) > 0 && (
              <div className="flex justify-between">
                <span className="text-ink-muted">Discount{quote.discountReason ? ` (${quote.discountReason})` : ''}</span>
                <span className="font-mono tabular-nums text-ink">-{currency(Number(quote.discount))}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-line pt-2">
              <span className="font-semibold text-ink">Total</span>
              <span className="font-mono text-base font-bold tabular-nums text-ink">{currency(Number(quote.total))}</span>
            </div>
          </div>
        </div>

        <SelectField
          label="Payment terms *"
          value={selectedTerm}
          onChange={(e) => setSelectedTerm(e.target.value as PaymentTermOption)}
          options={[
            { value: 'Net 15', label: 'Net 15' },
            { value: 'Net 30', label: 'Net 30' },
            { value: 'Net 45', label: 'Net 45' },
            { value: 'Net 60', label: 'Net 60' },
            { value: 'Due on Receipt', label: 'Due on Receipt' },
            { value: 'Custom', label: 'Custom' },
          ]}
        />

        {selectedTerm === 'Custom' && (
          <DateField
            label="Custom due date *"
            value={customDate}
            onChange={handleCustomDateChange}
            placeholder="Select custom due date"
            minDate={new Date().toISOString().split('T')[0]}
          />
        )}

        {dueDate && (
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3">
            <span className="text-sm text-ink-muted">Due date</span>
            <span className="font-mono text-sm font-medium tabular-nums text-ink">
              {new Date(dueDate).toLocaleDateString()}
            </span>
          </div>
        )}

        {selectedTerm !== 'Custom' && (
          <p className="text-xs text-ink-subtle">
            Due date:{' '}
            <span className="font-mono tabular-nums">
              {dueDate ? new Date(dueDate).toLocaleDateString() : 'Calculating...'}
            </span>
          </p>
        )}
      </div>
    </AppModal>
  )
}

export default ConvertQuoteToInvoiceModal
