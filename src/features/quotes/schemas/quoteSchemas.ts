import { z } from 'zod'

export const lineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  unitPrice: z.number().min(0, 'Unit price must be 0 or greater'),
})

export const quoteSchema = z.object({
  contactId: z.string().min(1, 'Contact is required'),
  title: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
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
  validUntil: z.string().optional(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']).optional(),
})

export type QuoteFormData = z.infer<typeof quoteSchema>

