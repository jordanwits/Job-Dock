import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { invoiceSchema, type InvoiceFormData } from '../schemas/invoiceSchemas'
import { Invoice } from '../types/invoice'
import { Input, Button, DatePicker, Select, Modal, Checkbox } from '@/components/ui'
import { useContactStore } from '@/features/crm/store/contactStore'
import ContactForm from '@/features/crm/components/ContactForm'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

interface InvoiceFormProps {
  invoice?: Invoice
  onSubmit: (data: InvoiceFormData) => Promise<void>
  onSaveAndSend?: (data: InvoiceFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  defaultContactId?: string
  defaultTitle?: string
  defaultNotes?: string
}

const InvoiceForm = ({
  invoice,
  onSubmit,
  onSaveAndSend,
  onCancel,
  isLoading,
  defaultContactId,
  defaultTitle,
  defaultNotes,
}: InvoiceFormProps) => {
  const { theme } = useTheme()
  const { contacts, fetchContacts, createContact } = useContactStore()
  const [showCreateContact, setShowCreateContact] = useState(false)
  const [isCreatingContact, setIsCreatingContact] = useState(false)

  useEffect(() => {
    if (contacts.length === 0) {
      fetchContacts()
    }
  }, [contacts.length, fetchContacts])

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
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
      })) || [{ description: '', quantity: 1, unitPrice: '' }],
      taxRate: invoice ? (invoice.taxRate > 0 ? invoice.taxRate * 100 : '') : '',
      discount: invoice?.discount && invoice.discount > 0 ? invoice.discount : '',
      discountReason: invoice?.discountReason || '',
      notes: invoice?.notes || defaultNotes || '',
      dueDate: invoice?.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : '',
      paymentTerms: invoice?.paymentTerms || 'Net 30',
      status: invoice?.status || 'draft',
      paymentStatus: invoice?.paymentStatus || 'pending',
      trackResponse: invoice?.trackResponse ?? true,
      trackPayment: invoice?.trackPayment ?? true,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lineItems',
  })

  const watchedLineItems = watch('lineItems')
  const watchedTaxRatePercent = Number(watch('taxRate')) || 0
  const watchedTaxRate = watchedTaxRatePercent / 100
  const watchedDiscount = Number(watch('discount')) || 0
  const contactIdValue = watch('contactId')
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
        taxRate: invoice.taxRate > 0 ? invoice.taxRate * 100 : '',
        discount: invoice.discount > 0 ? invoice.discount : '',
        discountReason: invoice.discountReason || '',
        notes: invoice.notes || '',
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : '',
        paymentTerms: invoice.paymentTerms || 'Net 30',
        status: invoice.status,
        paymentStatus: invoice.paymentStatus,
        trackResponse: invoice.trackResponse ?? true,
        trackPayment: invoice.trackPayment ?? true,
      })
    }
  }, [invoice, reset])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

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

  return (
    <>
      <form onSubmit={e => e.preventDefault()} className="space-y-6">
        {/* Contact Selection */}
        <div>
          <Select
            label="Contact *"
            {...register('contactId')}
            value={contactIdValue}
            error={errors.contactId?.message}
            onChange={e => {
              if (e.target.value === '__create_new__') {
                setShowCreateContact(true)
              } else {
                setValue('contactId', e.target.value)
              }
            }}
            options={[
              { value: '', label: 'Select a contact' },
              { value: '__create_new__', label: '+ Create New Contact' },
              ...contacts.map(contact => ({
                value: contact.id,
                label: `${contact.firstName} ${contact.lastName}${contact.company ? ` - ${contact.company}` : ''}`,
              })),
            ]}
          />
        </div>

        {/* Project Title */}
        <Input
          label="Project Title"
          placeholder="e.g., Kitchen Remodel, Office Renovation"
          error={errors.title?.message}
          {...register('title')}
        />

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className={cn(
              "block text-sm font-medium",
              theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
            )}>Line Items *</label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => append({ description: '', quantity: 1, unitPrice: '' })}
            >
              + Add Item
            </Button>
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className={cn(
                  "p-4 rounded-lg border space-y-3",
                  theme === 'dark'
                    ? 'border-primary-blue bg-primary-dark-secondary'
                    : 'border-gray-200 bg-white'
                )}
              >
                <div className="flex justify-between items-start">
                  <span className={cn(
                    "text-sm font-medium",
                    theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                  )}>Item {index + 1}</span>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className="text-red-500 hover:text-red-600"
                    >
                      Remove
                    </Button>
                  )}
                </div>

                <Input
                  label="Description"
                  placeholder="Item description"
                  error={errors.lineItems?.[index]?.description?.message}
                  {...register(`lineItems.${index}.description`)}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Quantity"
                    type="number"
                    step="0.01"
                    placeholder="1"
                    error={errors.lineItems?.[index]?.quantity?.message}
                    {...register(`lineItems.${index}.quantity`, {
                      valueAsNumber: true,
                    })}
                  />
                  <Input
                    label="Unit Price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    error={errors.lineItems?.[index]?.unitPrice?.message}
                    {...register(`lineItems.${index}.unitPrice`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>

                <div className={cn(
                  "text-right text-sm",
                  theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                )}>
                  Total:{' '}
                  {formatCurrency(
                    (Number(watchedLineItems[index]?.quantity) || 0) *
                      (Number(watchedLineItems[index]?.unitPrice) || 0)
                  )}
                </div>
              </div>
            ))}
          </div>
          {errors.lineItems && (
            <p className="mt-1 text-sm text-red-500">{errors.lineItems.message}</p>
          )}
        </div>

        {/* Tax and Discount */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Tax Rate (%)"
            type="number"
            step="0.01"
            placeholder="0"
            error={errors.taxRate?.message}
            {...register('taxRate', { valueAsNumber: true })}
            helperText="Enter as percentage (e.g., 8 for 8%)"
          />
          <Input
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
          <Input
            label="Discount Reason (Optional)"
            placeholder="e.g., Repeat customer discount, Seasonal promotion"
            error={errors.discountReason?.message}
            {...register('discountReason')}
            helperText="Provide a reason for this discount (will appear on invoice)"
          />
        )}

        {/* Totals Summary */}
        <div className={cn(
          "p-4 rounded-lg border",
          theme === 'dark'
            ? 'border-primary-blue bg-primary-dark-secondary'
            : 'border-gray-200 bg-white'
        )}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className={cn(
                theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
              )}>Subtotal</span>
              <span className={cn(
                theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
              )}>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className={cn(
                theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
              )}>Tax ({watchedTaxRatePercent}%)</span>
              <span className={cn(
                theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
              )}>{formatCurrency(taxAmount)}</span>
            </div>
            {watchedDiscount > 0 && (
              <div className="flex justify-between">
                <span className={cn(
                  theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                )}>Discount</span>
                <span className={cn(
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>-{formatCurrency(watchedDiscount)}</span>
              </div>
            )}
            <div className={cn(
              "flex justify-between pt-2 border-t",
              theme === 'dark' ? 'border-primary-blue' : 'border-gray-200'
            )}>
              <span className={cn(
                "text-lg font-semibold",
                theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
              )}>Total</span>
              <span className="text-lg font-bold text-primary-gold">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Payment Terms and Due Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Payment Terms"
            placeholder="Net 30"
            error={errors.paymentTerms?.message}
            {...register('paymentTerms')}
            helperText="e.g., Net 30, Due on receipt"
          />
          <DatePicker
            label="Due Date"
            value={watch('dueDate') || ''}
            onChange={date => setValue('dueDate', date)}
            error={errors.dueDate?.message}
            placeholder="Select due date"
          />
        </div>

        {/* Notes */}
        <div>
          <label className={cn(
            "block text-sm font-medium mb-2",
            theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
          )}>Notes</label>
          <textarea
            className={cn(
              "flex min-h-[100px] w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold disabled:cursor-not-allowed disabled:opacity-50",
              theme === 'dark'
                ? 'border-primary-blue bg-primary-dark-secondary text-primary-light placeholder:text-primary-light/50'
                : 'border-gray-200 bg-white text-primary-lightText placeholder:text-primary-lightTextSecondary'
            )}
            placeholder="Add notes about this invoice..."
            {...register('notes')}
          />
        </div>

        {/* Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Status"
            {...register('status')}
            value={statusValue}
            error={errors.status?.message}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'sent', label: 'Sent' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
          <Select
            label="Payment Status"
            {...register('paymentStatus')}
            value={paymentStatusValue}
            error={errors.paymentStatus?.message}
            options={[
              { value: 'pending', label: 'Unpaid' },
              { value: 'partial', label: 'Partial' },
              { value: 'paid', label: 'Paid' },
            ]}
          />
        </div>

        {/* Tracking Options */}
        <div className="space-y-3">
          <label className={cn(
            "block text-sm font-medium mb-2",
            theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
          )}>
            Tracking Options
          </label>
          <div className="space-y-3">
            <Checkbox
              id="trackResponse"
              label="Track Response (Include Accept/Decline buttons in email)"
              checked={watch('trackResponse') ?? true}
              onChange={e => setValue('trackResponse', e.target.checked)}
              error={errors.trackResponse?.message}
            />
            <Checkbox
              id="trackPayment"
              label="Track Payment (Enable payment status indicator)"
              checked={watch('trackPayment') ?? true}
              onChange={e => setValue('trackPayment', e.target.checked)}
              error={errors.trackPayment?.message}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
          {!invoice && onSaveAndSend && (
            <Button type="button" onClick={handleSaveAndSend} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save and Send'}
            </Button>
          )}
        </div>
      </form>

      {/* Create Contact Modal */}
      <Modal
        isOpen={showCreateContact}
        onClose={() => setShowCreateContact(false)}
        title="Create New Contact"
        size="lg"
      >
        <ContactForm
          onSubmit={handleCreateContact}
          onCancel={() => setShowCreateContact(false)}
          isLoading={isCreatingContact}
        />
      </Modal>
    </>
  )
}

export default InvoiceForm
