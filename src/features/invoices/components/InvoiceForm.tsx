import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { invoiceSchema, type InvoiceFormData } from '../schemas/invoiceSchemas'
import { Invoice } from '../types/invoice'
import { taxRateToPercent } from '@/lib/utils'
import {
  Alert,
  AlertIcon,
  AppButton,
  AppModal,
  CheckboxField,
  DateField,
  PlusIcon,
  SearchableSelectField,
  SelectField,
  TextAreaField,
  TextField,
  TrashIcon,
} from './invoicesUi'
import { useContactStore } from '@/features/crm/store/contactStore'
import ContactForm from '@/features/crm/components/ContactForm'
import { getSendValidationError } from '@/lib/utils/sendValidation'
import { PickSavedLineItemModal } from '@/features/line-items/components/PickSavedLineItemModal'
import { isDefaultPlaceholderLineItem } from '@/features/line-items/utils/isDefaultPlaceholderLineItem'

interface InvoiceFormProps {
  invoice?: Invoice
  onSubmit: (data: InvoiceFormData) => Promise<void>
  onSaveAndSend?: (data: InvoiceFormData) => Promise<void>
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

const InvoiceForm = ({
  invoice,
  onSubmit,
  onSaveAndSend,
  onCancel,
  isLoading,
  error: formError,
  defaultContactId,
  defaultTitle,
  defaultNotes,
  defaultPrice,
}: InvoiceFormProps) => {
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
      const id = requestAnimationFrame(() => {
        errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
      return () => cancelAnimationFrame(id)
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
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      contactId: invoice?.contactId || defaultContactId || '',
      title: invoice?.title || defaultTitle || '',
      lineItems: invoice?.lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity > 0 ? item.quantity : '',
        unitPrice: item.unitPrice > 0 ? item.unitPrice : '',
      })) ||
        (defaultPrice != null
          ? [{ description: defaultTitle || 'Services', quantity: 1, unitPrice: defaultPrice }]
          : [{ description: '', quantity: 1, unitPrice: '' }]),
      taxRate: invoice ? (invoice.taxRate > 0 ? taxRateToPercent(invoice.taxRate) : '') : '',
      discount: invoice?.discount && invoice.discount > 0 ? invoice.discount : '',
      discountReason: invoice?.discountReason || '',
      notes: invoice?.notes || defaultNotes || '',
      dueDate: invoice?.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : '',
      paymentTerms: invoice?.paymentTerms || 'Net 30',
      status: invoice?.status || 'draft',
      paymentStatus: invoice?.paymentStatus || 'pending',
      trackPayment: invoice?.trackPayment ?? true,
    },
  })

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'lineItems',
  })

  const watchedLineItems = watch('lineItems')
  const watchedTaxRatePercent = Number(watch('taxRate')) || 0
  const watchedTaxRate = watchedTaxRatePercent / 100
  const watchedDiscount = Number(watch('discount')) || 0
  const statusValue = watch('status')
  const paymentStatusValue = watch('paymentStatus')

  // Calculate totals
  const subtotal = watchedLineItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  )
  const taxAmount = subtotal * watchedTaxRate
  const total = subtotal + taxAmount - watchedDiscount

  useEffect(() => {
    if (invoice) {
      reset({
        contactId: invoice.contactId,
        title: invoice.title || '',
        lineItems: invoice.lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity > 0 ? item.quantity : '',
          unitPrice: item.unitPrice > 0 ? item.unitPrice : '',
        })),
        taxRate: invoice.taxRate > 0 ? taxRateToPercent(invoice.taxRate) : '',
        discount: invoice.discount > 0 ? invoice.discount : '',
        discountReason: invoice.discountReason || '',
        notes: invoice.notes || '',
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : '',
        paymentTerms: invoice.paymentTerms || 'Net 30',
        status: invoice.status,
        paymentStatus: invoice.paymentStatus,
        trackPayment: invoice.trackPayment ?? true,
      })
    }
  }, [invoice, reset])

  const handleFormSubmit = async (data: InvoiceFormData, shouldSend: boolean = false) => {
    const { dateStringToISO } = await import('@/lib/utils/dateUtils')

    const cleanedData = {
      ...data,
      title: data.title || undefined,
      taxRate: (Number(data.taxRate) || 0) / 100,
      discount: Number(data.discount) || 0,
      discountReason: data.discountReason || undefined,
      notes: data.notes || undefined,
      dueDate: dateStringToISO(data.dueDate),
      paymentTerms: data.paymentTerms || undefined,
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

        {/* Invoice Title - pulled from project title when creating from a job */}
        <TextField
          label="Invoice title *"
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
            helperText="Provide a reason for this discount (will appear on invoice)"
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

        {/* Payment Terms and Due Date */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Payment terms"
            placeholder="Net 30"
            error={errors.paymentTerms?.message}
            helperText="e.g., Net 30, Due on receipt"
            {...register('paymentTerms')}
          />
          <Controller
            name="dueDate"
            control={control}
            render={({ field }) => (
              <DateField
                label="Due date"
                value={field.value || ''}
                onChange={field.onChange}
                error={errors.dueDate?.message}
                placeholder="Select due date"
              />
            )}
          />
        </div>

        {/* Notes */}
        <TextAreaField
          label="Notes"
          placeholder="Add notes about this invoice..."
          error={errors.notes?.message}
          {...register('notes')}
        />

        {/* Status */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField
            label="Status"
            value={statusValue}
            error={errors.status?.message}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'sent', label: 'Sent' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            {...register('status')}
          />
          <SelectField
            label="Payment status"
            value={paymentStatusValue}
            error={errors.paymentStatus?.message}
            options={[
              { value: 'pending', label: 'Unpaid' },
              { value: 'partial', label: 'Partial' },
              { value: 'paid', label: 'Paid' },
            ]}
            {...register('paymentStatus')}
          />
        </div>

        {/* Tracking Options */}
        <div>
          <label className={labelCls}>Tracking options</label>
          <CheckboxField
            id="trackPayment"
            checked={watch('trackPayment') ?? true}
            onChange={checked => setValue('trackPayment', checked)}
            label="Track payment"
            description="Enable the payment status indicator for this invoice"
          />
        </div>

        {/* Save and Send error - shown near buttons so user sees feedback when they click */}
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
          {!invoice && onSaveAndSend && (
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

export default InvoiceForm
