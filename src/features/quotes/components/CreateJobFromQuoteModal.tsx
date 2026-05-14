import { useState, useEffect } from 'react'
import { Modal, Button, Input, Textarea } from '@/components/ui'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { Quote } from '../types/quote'
import { useTheme } from '@/contexts/ThemeContext'
import { useContactStore } from '@/features/crm/store/contactStore'
import { useJobStore } from '@/features/scheduling/store/jobStore'
import { cn } from '@/lib/utils'

interface CreateJobFromQuoteModalProps {
  quote: Quote
  isOpen: boolean
  onClose: () => void
  onSuccess?: (job: { id: string }) => void
}

const CreateJobFromQuoteModal = ({
  quote,
  isOpen,
  onClose,
  onSuccess,
}: CreateJobFromQuoteModalProps) => {
  const { theme } = useTheme()
  const { contacts, fetchContacts } = useContactStore()
  const { createJob, isLoading, error, clearError } = useJobStore()

  const getDefaultTitle = () =>
    quote.title?.trim() ? quote.title : `Job for ${quote.quoteNumber}`

  const getDefaultNotes = () =>
    [
      quote.notes?.trim(),
      quote.lineItems?.length
        ? `\nFrom quote ${quote.quoteNumber}:\n${quote.lineItems
            .map(
              (item: { description?: string; quantity?: number; unitPrice?: number }) =>
                `- ${item.description ?? ''} (${item.quantity ?? 0} × $${Number(item.unitPrice ?? 0).toFixed(2)})`
            )
            .join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('')

  const [title, setTitle] = useState(() => getDefaultTitle())
  const [contactId, setContactId] = useState(quote.contactId)
  const [price, setPrice] = useState(() => String(quote.total ?? 0))
  const [notes, setNotes] = useState(() => getDefaultNotes())
  const [description, setDescription] = useState(quote.lineItems?.[0]?.description ?? '')
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchContacts()
      setTitle(getDefaultTitle())
      setContactId(quote.contactId)
      setPrice(String(quote.total ?? 0))
      setNotes(getDefaultNotes())
      setDescription(quote.lineItems?.[0]?.description ?? '')
    }
  }, [isOpen, quote.id, quote.title, quote.notes, quote.contactId, quote.total, quote.quoteNumber, quote.lineItems])

  useEffect(() => {
    if (!isOpen) {
      clearError()
      setSubmitError(null)
    }
  }, [isOpen, clearError])

  const contactOptions = contacts.map(c => ({
    value: c.id,
    label:
      `${c.firstName} ${c.lastName}${c.company ? ` - ${c.company}` : ''}`.trim() || c.email || c.id,
  }))

  const handleCreate = async () => {
    const trimmedTitle = title?.trim()
    if (!trimmedTitle) {
      setSubmitError('Title is required')
      return
    }
    if (!contactId) {
      setSubmitError('Contact is required')
      return
    }
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) {
      setSubmitError('Price must be a valid number')
      return
    }

    setSubmitError(null)
    try {
      const created = await createJob({
        title: trimmedTitle,
        contactId,
        quoteId: quote.id,
        price: priceNum,
        notes: notes?.trim() || undefined,
        description: description?.trim() || undefined,
        toBeScheduled: true,
      })
      clearError()
      onClose()
      if (onSuccess) {
        onSuccess(created)
      }
    } catch (e: any) {
      setSubmitError(e?.message || 'Failed to create job')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Job from Quote"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Job'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className={cn(
          theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
        )}>
          Review and edit the job details below. The quote will be linked so you can convert to invoice later.
        </p>

        <Input
          label="Title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Kitchen Remodel, Office Renovation"
          error={submitError && !title?.trim() ? submitError : undefined}
        />

        <SearchableSelect
          label="Contact *"
          options={contactOptions}
          value={contactId}
          onChange={(id) => setContactId(id || '')}
          placeholder="Select contact"
          searchPlaceholder="Search by name or company..."
        />

        <Input
          label="Price"
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.00"
        />

        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional job description"
          rows={2}
          className={cn(
            theme === 'dark'
              ? 'border-primary-blue bg-primary-dark-secondary text-primary-light'
              : 'border-gray-200 bg-white text-primary-lightText'
          )}
        />

        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes"
          rows={4}
          className={cn(
            theme === 'dark'
              ? 'border-primary-blue bg-primary-dark-secondary text-primary-light'
              : 'border-gray-200 bg-white text-primary-lightText'
          )}
        />

        {(error || submitError) && (
          <div className="p-3 rounded-lg border border-red-500 bg-red-500/10">
            <p className="text-sm text-red-400">{error || submitError}</p>
          </div>
        )}

        <div className={cn(
          "p-3 rounded-lg border text-sm",
          theme === 'dark'
            ? 'border-primary-blue bg-primary-dark-secondary'
            : 'border-gray-200 bg-gray-50'
        )}>
          <p className={cn(
            theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
          )}>
            This job will be created with the quote <strong>{quote.quoteNumber}</strong> linked. You can later convert the job to an invoice from the Jobs page.
          </p>
        </div>
      </div>
    </Modal>
  )
}

export default CreateJobFromQuoteModal
