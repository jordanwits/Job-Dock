import { z } from 'zod'

export const jobBreakSchema = z.object({
  id: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  reason: z.string().optional(),
})

export const recurrenceSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  interval: z.number().int().min(1).max(4),
  count: z.number().int().min(2).max(50).optional(),
  untilDate: z.string().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
})

export const jobAssignmentSchema = z.object({
  // NOTE: These are edited via custom UI + setValue(), not registered inputs.
  // Empty placeholder rows can exist transiently (e.g., "Add another team member"),
  // so validation here must not block form submission. We filter out empty rows before submit.
  userId: z.string().optional(),
  role: z.string().optional(),
  price: z.number().optional().nullable(),
  payType: z.enum(['job', 'hourly']).optional(),
  hourlyRate: z.number().nullable().optional(),
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
  status: z.enum(['active', 'scheduled', 'in-progress', 'completed', 'cancelled', 'pending-confirmation']).optional(),
  location: z.string().optional(),
  price: z.string().optional().or(z.number().optional()),
  notes: z.string().optional(),
  assignedTo: z.array(jobAssignmentSchema).optional(),
  breaks: z.array(jobBreakSchema).optional(),
  recurrence: recurrenceSchema.optional(),
})

export type JobFormData = z.infer<typeof jobSchema>

