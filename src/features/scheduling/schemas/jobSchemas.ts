import { z } from 'zod'

export const jobBreakSchema = z.object({
  id: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  reason: z.string().optional(),
})

export const recurrenceSchema = z.object({
  frequency: z.enum(['weekly', 'monthly']),
  interval: z.number().int().min(1).max(4),
  count: z.number().int().min(2).max(50).optional(),
  untilDate: z.string().optional(),
})

export const jobSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  contactId: z.string().min(1, 'Contact is required'),
  serviceId: z.string().optional(),
  quoteId: z.string().optional(),
  invoiceId: z.string().optional(),
  startTime: z.string().optional(), // Computed from date/time pickers
  endTime: z.string().optional(), // Computed from date/time pickers
  status: z.enum(['scheduled', 'in-progress', 'completed', 'cancelled', 'pending-confirmation']).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  assignedTo: z.string().optional(),
  breaks: z.array(jobBreakSchema).optional(),
  recurrence: recurrenceSchema.optional(),
})

export type JobFormData = z.infer<typeof jobSchema>

