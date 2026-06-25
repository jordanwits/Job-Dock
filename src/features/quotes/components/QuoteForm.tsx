import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { quoteSchema, type QuoteFormData } from '../schemas/quoteSchemas'
import { Quote } from '../types/quote'
import {
  Alert,
  AlertIcon,
  AppButton,
  AppModal,
  DateField,
  PlusIcon,
  SearchableSelectField,
  SelectField,
  TextAreaField,
  TextField,
  TrashIcon,
} from './quotesUi'
import { useContactStore } from '@/features/crm/store/contactStore'
import ContactForm from '@/features/crm/components/ContactForm'
import { getSendValidationError } from '@/lib/utils/sendValidation'
import { PickSavedLineItemModal } from '@/features/line-items/components/PickSavedLineItemModal'
import { isDefaultPlaceholderLineItem } from '@/features/line-items/utils/isDefaultPlaceholderLineItem'

interface QuoteFormProps {
  quote?: Quote
  onSubmit: (data: QuoteFormData) => Promise<void>
  onSaveAndSend?: (data: QuoteFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  error?: string | null
  defaultContactId?: string
  defaultTitle?: string
  defaultNotes?: string
  defaultPrice?: number
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

const QuoteForm = ({
  quote,
  onSubmit,
  onSaveAndSend,
  onCancel,
  isLoading,
  error: formError,
  defaultContactId,
  defaultTitle,
  defaultNotes,
  defaultPrice,
}: QuoteFormProps) => {
  const { contacts, fetchContacts, createContact, error: contactError, clearError: clearContactError } = useContactStore()
  const [showCreateContact, setShowCreateContact] = useState(false)
  const [isCreatingContact, setIsCreatingContact] = useState(false)
  const [saveAndSendError, setSaveAndSendError] = useState<string | null>(null)
  const [savedLinePickerOpen, setSavedLinePickerOpen] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (contacts.length === 0) {
      fetchContacts()
    }
  }, [contacts.length, fetchContacts])

  useEffect(() => {
    if (formError || saveAndSendError) {
      const timer = requestAnimationFrame(() => {
        errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
      return () => cancelAnimationFrame(timer)
    }
  }, [formError, saveAndSendError])

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors },
    reset,
  } = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      contactId: quote?.contactId || defaultContactId || '',
      title: quote?.title || defaultTitle || '',
      lineItems: quote?.lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity > 0 ? item.quantity : '',
        unitPrice: item.unitPrice > 0 ? item.unitPrice : '',
      })) ||
        (defaultPrice != null
          ? [{ description: defaultTitle || 'Services', quantity: 1, unitPrice: defaultPrice }]
          : [{ description: '', quantity: 1, unitPrice: '' }]),
      taxRate: quote ? (quote.taxRate > 0 ? quote.taxRate * 100 : '') : '',
      discount: quote?.discount && quote.discount > 0 ? quote.discount : '',
      discountReason: quote?.discountReason || '',
      notes: quote?.notes || defaultNotes || '',
      validUntil: quote?.validUntil ? new Date(quote.validUntil).toISOString().split('T')[0] : '',
      status: quote?.status || 'draft',
    },
  })

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'lineItems',
  })

  const watchedLineItems = watch('lineItems')
  const watchedTaxRatePercent = Number(watch('taxRate')) || 0
  const watchedTaxRate = watchedTaxRatePercent / 100 // Convert percentage to decimal
  const watchedDiscount = Number(watch('discount')) || 0
  const statusValue = watch('status')

  // Calculate totals
  const subtotal = watchedLineItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  )
  const taxAmount = subtotal * watchedTaxRate
  const total = subtotal + taxAmount - watchedDiscount

  useEffect(() => {
    if (quote) {
      reset({
        contactId: quote.contactId,
        title: quote.title || '',
        lineItems: quote.lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity > 0 ? item.quantity : '',
          unitPrice: item.unitPrice > 0 ? item.unitPrice : '',
        })),
        taxRate: quote.taxRate > 0 ? quote.taxRate * 100 : '', // Convert decimal to percentage for display
        discount: quote.discount > 0 ? quote.discount : '',
        discountReason: quote.discountReason || '',
        notes: quote.notes || '',
        validUntil: quote.validUntil ? new Date(quote.validUntil).toISOString().split('T')[0] : '',
        status: quote.status,
      })
    }
  }, [quote, reset])

  const handleFormSubmit = async (data: QuoteFormData, shouldSend: boolean = false) => {
    const { dateStringToISO } = await import('@/lib/utils/dateUtils')

    // Convert tax rate from percentage to decimal, auto-zero if empty
    const cleanedData = {
      ...data,
      taxRate: (Number(data.taxRate) || 0) / 100,
      discount: Number(data.discount) || 0,
      discountReason: data.discountReason || undefined,
      notes: data.notes || undefined,
      validUntil: dateStringToISO(data.validUntil),
      lineItems: data.lineItems.map(item => ({
        ...item,
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
      })),
    }

    if (shouldSend && onSaveAndSend) {
      const selectedContact = contacts.find(c => c.id === data.contactId)
      const validationError = selectedContact
        ? getSendValidationError({
            contactEmail: selectedContact.email,
            contactPhone: selectedContact.phone?.trim(),
            contactNotificationPreference: selectedContact.notificationPreference ?? 'both',
          })
        : 'Please select a contact.'
      if (validationError) {
        setSaveAndSendError(validationError)
        setTimeout(() => setSaveAndSendError(null), 6000)
        return
      }
      setSaveAndSendError(null)
      await onSaveAndSend(cleanedData)
    } else {
      await onSubmit(cleanedData)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    await handleSubmit(data => handleFormSubmit(data, false))()
  }

  const handleSaveAndSend = async (e: React.FormEvent) => {
    e.preventDefault()
    await handleSubmit(data => handleFormSubmit(data, true))()
  }

  const handleCreateContact = async (data: any) => {
    setIsCreatingContact(true)
    try {
      const newContact = await createContact(data)
      if (newContact) {
        setValue('contactId', newContact.id)
        setShowCreateContact(false)
        await fetchContacts() // Refresh contacts list
      }
    } catch (error) {
      // Error handled by store
    } finally {
      setIsCreatingContact(false)
    }
  }

  const labelCls = 'mb-1.5 block text-sm font-medium text-ink'

  return (
    <>
      <form onSubmit={e => e.preventDefault()} className="space-y-6">
        {(formError || saveAndSendError) && (
          <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
            {formError || saveAndSendError}
          </Alert>
        )}

        {/* Contact Selection */}
        <Controller
          name="contactId"
          control={control}
          render={({ field }) => (
            <SearchableSelectField
              label="Contact *"
              placeholder="Select a contact"
              searchPlaceholder="Search by name or company..."
              value={field.value}
              onChange={value => {
                if (value === '__create_new__') {
                  setShowCreateContact(true)
                } else {
                  field.onChange(value)
                }
              }}
              error={errors.contactId?.message}
              options={[
                { value: '__create_new__', label: '+ Create new contact' },
                ...contacts.map(contact => ({
                  value: contact.id,
                  label: `${contact.firstName} ${contact.lastName}${contact.company ? ` - ${contact.company}` : ''}`,
                })),
              ]}
            />
          )}
        />

        {/* Quote Title - pulled from project title when creating from a job */}
        <TextField
          label="Quote title *"
          placeholder="e.g., Kitchen Remodel, Office Renovation"
          error={errors.title?.message}
          {...register('title')}
        />

        {/* Line Items */}
        <div>
          <label className={labelCls}>Line items *</label>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="space-y-3 rounded-xl border border-line bg-surface-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">Item {index + 1}</span>
                  {fields.length > 1 && (
                    <AppButton type="button" variant="dangerGhost" size="sm" onClick={() => remove(index)}>
                      <TrashIcon className="h-4 w-4" />
                      Remove
                    </AppButton>
                  )}
                </div>

                <TextField
                  label="Description"
                  placeholder="Item description"
                  error={errors.lineItems?.[index]?.description?.message}
                  {...register(`lineItems.${index}.description`)}
                />

                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Quantity"
                    type="number"
                    step="0.01"
                    placeholder="1"
                    error={errors.lineItems?.[index]?.quantity?.message}
                    {...register(`lineItems.${index}.quantity`, { valueAsNumber: true })}
                  />
                  <TextField
                    label="Unit price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    error={errors.lineItems?.[index]?.unitPrice?.message}
                    {...register(`lineItems.${index}.unitPrice`, { valueAsNumber: true })}
                  />
                </div>

                <div className="text-right text-sm text-ink-muted">
                  Total:{' '}
                  <span className="font-mono font-medium tabular-nums text-ink">
                    {formatCurrency(
                      (Number(watchedLineItems[index]?.quantity) || 0) *
                        (Number(watchedLineItems[index]?.unitPrice) || 0)
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <AppButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => append({ description: '', quantity: 1, unitPrice: '' })}
            >
              <PlusIcon className="h-4 w-4" />
              Add item
            </AppButton>
            <AppButton type="button" variant="subtle" size="sm" onClick={() => setSavedLinePickerOpen(true)}>
              <PlusIcon className="h-4 w-4" />
              From saved
            </AppButton>
          </div>
          {errors.lineItems && typeof errors.lineItems.message === 'string' && (
            <p className="mt-1.5 text-[13px] text-danger">{errors.lineItems.message}</p>
          )}
        </div>

        {/* Tax and Discount */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Tax rate (%)"
            type="number"
            step="0.01"
            placeholder="0"
            error={errors.taxRate?.message}
            helperText="Enter as percentage (e.g., 8 for 8%)"
            {...register('taxRate', { valueAsNumber: true })}
          />
          <TextField
            label="Discount ($)"
            type="number"
            step="0.01"
            placeholder="0.00"
            error={errors.discount?.message}
            {...register('discount', { valueAsNumber: true })}
          />
        </div>

        {/* Discount Reason - Only show if discount is applied */}
        {watchedDiscount > 0 && (
          <TextField
            label="Discount reason (optional)"
            placeholder="e.g., Repeat customer discount, Seasonal promotion"
            error={errors.discountReason?.message}
            helperText="Provide a reason for this discount (will appear on quote)"
            {...register('discountReason')}
          />
        )}

        {/* Totals Summary */}
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-muted">Subtotal</span>
              <span className="font-mono tabular-nums text-ink">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Tax ({watchedTaxRatePercent}%)</span>
              <span className="font-mono tabular-nums text-ink">{formatCurrency(taxAmount)}</span>
            </div>
            {watchedDiscount > 0 && (
              <div className="flex justify-between">
                <span className="text-ink-muted">Discount</span>
                <span className="font-mono tabular-nums text-ink">-{formatCurrency(watchedDiscount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-line pt-2">
              <span className="text-base font-semibold text-ink">Total</span>
              <span className="font-mono text-base font-bold tabular-nums text-ink">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Valid Until */}
        <Controller
          name="validUntil"
          control={control}
          render={({ field }) => (
            <DateField
              label="Valid until *"
              value={field.value || ''}
              onChange={field.onChange}
              error={errors.validUntil?.message}
              placeholder="Select expiration date"
              minDate={new Date().toISOString().split('T')[0]}
            />
          )}
        />

        {/* Notes */}
        <TextAreaField
          label="Notes"
          placeholder="Add notes about this quote..."
          error={errors.notes?.message}
          {...register('notes')}
        />

        {/* Status */}
        <SelectField
          label="Status"
          value={statusValue}
          error={errors.status?.message}
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'sent', label: 'Sent' },
            { value: 'accepted', label: 'Accepted' },
            { value: 'rejected', label: 'Declined' },
            { value: 'expired', label: 'Expired' },
          ]}
          {...register('status')}
        />

        {(formError || saveAndSendError) && (
          <div ref={errorRef}>
            <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
              {formError || saveAndSendError}
            </Alert>
          </div>
        )}

        <div className="flex flex-col-reverse justify-end gap-3 pt-2 sm:flex-row">
          <AppButton type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
            Cancel
          </AppButton>
          <AppButton type="button" variant="subtle" onClick={handleSave} disabled={isLoading} isLoading={isLoading}>
            {isLoading ? 'Saving...' : 'Save'}
          </AppButton>
          {onSaveAndSend && (
            <AppButton type="button" onClick={handleSaveAndSend} disabled={isLoading} isLoading={isLoading}>
              {isLoading ? 'Saving...' : 'Save and send'}
            </AppButton>
          )}
        </div>
      </form>

      <PickSavedLineItemModal
        isOpen={savedLinePickerOpen}
        onClose={() => setSavedLinePickerOpen(false)}
        onSelect={line => {
          const row = {
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
          }
          const items = getValues('lineItems')
          if (items.length === 1 && isDefaultPlaceholderLineItem(items[0])) {
            update(0, row)
          } else {
            append(row)
          }
        }}
      />

      {/* Create Contact Modal */}
      <AppModal
        isOpen={showCreateContact}
        onClose={() => {
          clearContactError()
          setShowCreateContact(false)
        }}
        title="Create new contact"
        size="lg"
      >
        <ContactForm
          onSubmit={handleCreateContact}
          onCancel={() => {
            clearContactError()
            setShowCreateContact(false)
          }}
          isLoading={isCreatingContact}
          error={contactError}
        />
      </AppModal>
    </>
  )
}

export default QuoteForm
