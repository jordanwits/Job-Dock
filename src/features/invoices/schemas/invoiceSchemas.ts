import { z } from 'zod'

export const invoiceLineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  unitPrice: z.number().min(0, 'Unit price must be 0 or greater'),
})

export const invoiceSchema = z.object({
  contactId: z.string().min(1, 'Contact is required'),
  title: z.string().optional(),
  lineItems: z.array(invoiceLineItemSchema).min(1, 'At least one line item is required'),
  taxRate: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)),
    z.number().min(0).max(100)
  ),
  discount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val)),
    z.number().min(0)
  ),
  discountReason: z.string().optional(),
  notes: z.string().optional(),
  dueDate: z.string().optional(),
  paymentTerms: z.string().optional(),
  status: z.enum(['draft', 'sent', 'overdue', 'cancelled']).optional(),
  paymentStatus: z.enum(['pending', 'partial', 'paid']).optional(),
  trackResponse: z.boolean().optional(),
  trackPayment: z.boolean().optional(),
})

export type InvoiceFormData = z.infer<typeof invoiceSchema>

