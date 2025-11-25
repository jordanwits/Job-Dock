import { useState, useEffect } from 'react'
import { Modal, Button, DatePicker, Select } from '@/components/ui'
import { Quote } from '../types/quote'

interface ConvertQuoteToInvoiceModalProps {
  quote: Quote
  isOpen: boolean
  onClose: () => void
  onConvert: (options: { paymentTerms: string; dueDate: string }) => Promise<void>
  isLoading?: boolean
}

type PaymentTermOption = 'Net 15' | 'Net 30' | 'Net 45' | 'Net 60' | 'Due on Receipt' | 'Custom'

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
    const finalDueDate = dueDate || calculateDueDate('Net 30')
    await onConvert({ paymentTerms, dueDate: finalDueDate })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Convert ${quote.quoteNumber} to Invoice`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleConvert} 
            disabled={isLoading || (selectedTerm === 'Custom' && !customDate)}
          >
            {isLoading ? 'Converting...' : 'Convert to Invoice'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-primary-light/70">
          This will create a new invoice based on the quote. You can customize the payment terms and due date below.
        </p>

        <div className="p-4 rounded-lg border border-primary-blue bg-primary-dark-secondary">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-primary-light/70">Quote Total</span>
              <span className="text-lg font-bold text-primary-gold">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(quote.total)}
              </span>
            </div>
          </div>
        </div>

        <Select
          label="Payment Terms *"
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
          <DatePicker
            label="Custom Due Date *"
            value={customDate}
            onChange={handleCustomDateChange}
            placeholder="Select custom due date"
            minDate={new Date().toISOString().split('T')[0]}
          />
        )}

        {dueDate && (
          <div className="p-3 rounded-lg border border-primary-blue bg-primary-dark-secondary">
            <div className="flex justify-between items-center">
              <span className="text-sm text-primary-light/70">Due Date</span>
              <span className="text-sm font-medium text-primary-light">
                {new Date(dueDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}

        {selectedTerm !== 'Custom' && (
          <p className="text-xs text-primary-light/50">
            Due date: {dueDate ? new Date(dueDate).toLocaleDateString() : 'Calculating...'}
          </p>
        )}
      </div>
    </Modal>
  )
}

export default ConvertQuoteToInvoiceModal

