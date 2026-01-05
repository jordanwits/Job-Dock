import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { invoiceSchema, type InvoiceFormData } from '../schemas/invoiceSchemas'
import { Invoice } from '../types/invoice'
import { Input, Button, DatePicker, Select } from '@/components/ui'
import { useContactStore } from '@/features/crm/store/contactStore'

interface InvoiceFormProps {
  invoice?: Invoice
  onSubmit: (data: InvoiceFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

const InvoiceForm = ({ invoice, onSubmit, onCancel, isLoading }: InvoiceFormProps) => {
  const { contacts, fetchContacts } = useContactStore()

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
      contactId: invoice?.contactId || '',
      lineItems: invoice?.lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })) || [{ description: '', quantity: 1, unitPrice: 0 }],
      taxRate: invoice ? invoice.taxRate * 100 : 8,
      discount: invoice?.discount || 0,
      notes: invoice?.notes || '',
      dueDate: invoice?.dueDate
        ? new Date(invoice.dueDate).toISOString().split('T')[0]
        : '',
      paymentTerms: invoice?.paymentTerms || 'Net 30',
      status: invoice?.status || 'draft',
      paymentStatus: invoice?.paymentStatus || 'pending',
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lineItems',
  })

  const watchedLineItems = watch('lineItems')
  const watchedTaxRatePercent = watch('taxRate') || 0
  const watchedTaxRate = watchedTaxRatePercent / 100
  const watchedDiscount = watch('discount') || 0
  const contactIdValue = watch('contactId')
  const statusValue = watch('status')
  const paymentStatusValue = watch('paymentStatus')

  // Calculate totals
  const subtotal = watchedLineItems.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
    0
  )
  const taxAmount = subtotal * watchedTaxRate
  const total = subtotal + taxAmount - watchedDiscount

  useEffect(() => {
    if (invoice) {
      reset({
        contactId: invoice.contactId,
        lineItems: invoice.lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        taxRate: invoice.taxRate * 100,
        discount: invoice.discount,
        notes: invoice.notes || '',
        dueDate: invoice.dueDate
          ? new Date(invoice.dueDate).toISOString().split('T')[0]
          : '',
        paymentTerms: invoice.paymentTerms || 'Net 30',
        status: invoice.status,
        paymentStatus: invoice.paymentStatus,
      })
    }
  }, [invoice, reset])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const handleFormSubmit = async (data: InvoiceFormData) => {
    const cleanedData = {
      ...data,
      taxRate: data.taxRate ? data.taxRate / 100 : 0,
      notes: data.notes || undefined,
      dueDate: data.dueDate || undefined,
      paymentTerms: data.paymentTerms || undefined,
    }
    await onSubmit(cleanedData)
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Contact Selection */}
      <Select
        label="Contact *"
        {...register('contactId')}
        value={contactIdValue}
        error={errors.contactId?.message}
        options={[
          { value: '', label: 'Select a contact' },
          ...contacts.map((contact) => ({
            value: contact.id,
            label: `${contact.firstName} ${contact.lastName}${contact.company ? ` - ${contact.company}` : ''}`,
          })),
        ]}
      />

      {/* Line Items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-primary-light">
            Line Items *
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
          >
            + Add Item
          </Button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="p-4 rounded-lg border border-primary-blue bg-primary-dark-secondary space-y-3"
            >
              <div className="flex justify-between items-start">
                <span className="text-sm font-medium text-primary-light">
                  Item {index + 1}
                </span>
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

              <div className="text-right text-sm text-primary-light/70">
                Total: {formatCurrency(
                  (watchedLineItems[index]?.quantity || 0) *
                    (watchedLineItems[index]?.unitPrice || 0)
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
          placeholder="8"
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

      {/* Totals Summary */}
      <div className="p-4 rounded-lg border border-primary-blue bg-primary-dark-secondary">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-primary-light/70">Subtotal</span>
            <span className="text-primary-light">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-primary-light/70">Tax ({watchedTaxRatePercent}%)</span>
            <span className="text-primary-light">{formatCurrency(taxAmount)}</span>
          </div>
          {watchedDiscount > 0 && (
            <div className="flex justify-between">
              <span className="text-primary-light/70">Discount</span>
              <span className="text-primary-light">-{formatCurrency(watchedDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-primary-blue">
            <span className="text-lg font-semibold text-primary-light">Total</span>
            <span className="text-lg font-bold text-primary-gold">
              {formatCurrency(total)}
            </span>
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
          onChange={(date) => setValue('dueDate', date)}
          error={errors.dueDate?.message}
          placeholder="Select due date"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-primary-light mb-2">
          Notes
        </label>
        <textarea
          className="flex min-h-[100px] w-full rounded-lg border border-primary-blue bg-primary-dark-secondary px-3 py-2 text-sm text-primary-light placeholder:text-primary-light/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold disabled:cursor-not-allowed disabled:opacity-50"
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
            { value: 'pending', label: 'Pending' },
            { value: 'partial', label: 'Partial' },
            { value: 'paid', label: 'Paid' },
          ]}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : invoice ? 'Update Invoice' : 'Create Invoice'}
        </Button>
      </div>
    </form>
  )
}

export default InvoiceForm

