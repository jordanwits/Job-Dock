import { z } from 'zod'

export const savedLineItemCreateFormSchema = z.object({
  description: z.string().min(1, 'Description is required').max(5000),
  defaultQuantity: z.coerce.number().min(0).max(999999).optional().default(1),
  unitPrice: z.coerce.number().min(0).max(99999999).optional().default(0),
})

export type SavedLineItemCreateFormData = z.infer<typeof savedLineItemCreateFormSchema>

export const savedLineItemFormSchema = savedLineItemCreateFormSchema

export type SavedLineItemFormData = SavedLineItemCreateFormData
