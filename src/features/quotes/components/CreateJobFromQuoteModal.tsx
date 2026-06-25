import { useState, useEffect } from 'react'
import { Quote } from '../types/quote'
import { useContactStore } from '@/features/crm/store/contactStore'
import { useJobStore } from '@/features/scheduling/store/jobStore'
import {
  Alert,
  AlertIcon,
  AppButton,
  AppModal,
  SearchableSelectField,
  TextAreaField,
  TextField,
} from './quotesUi'

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
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create job from quote"
      size="lg"
      footer={
        <>
          <AppButton variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </AppButton>
          <AppButton onClick={handleCreate} disabled={isLoading} isLoading={isLoading}>
            {isLoading ? 'Creating...' : 'Create job'}
          </AppButton>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-ink-muted">
          Review and edit the job details below. The quote will be linked so you can convert to invoice later.
        </p>

        <TextField
          label="Title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Kitchen Remodel, Office Renovation"
          error={submitError && !title?.trim() ? submitError : undefined}
        />

        <SearchableSelectField
          label="Contact *"
          options={contactOptions}
          value={contactId}
          onChange={(id) => setContactId(id || '')}
          placeholder="Select contact"
          searchPlaceholder="Search by name or company..."
        />

        <TextField
          label="Price"
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.00"
        />

        <TextAreaField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional job description"
          className="min-h-[64px]"
        />

        <TextAreaField
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes"
        />

        {(error || submitError) && (
          <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
            {error || submitError}
          </Alert>
        )}

        <div className="rounded-xl border border-line bg-surface-2 p-3">
          <p className="text-sm text-ink-muted">
            This job will be created with the quote{' '}
            <strong className="font-mono text-ink">{quote.quoteNumber}</strong> linked. You can later convert the job
            to an invoice from the Jobs page.
          </p>
        </div>
      </div>
    </AppModal>
  )
}

export default CreateJobFromQuoteModal
