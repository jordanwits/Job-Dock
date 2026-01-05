import { z } from 'zod'

export const jobSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  contactId: z.string().min(1, 'Contact is required'),
  serviceId: z.string().optional(),
  startTime: z.string().optional(), // Computed from date/time pickers
  endTime: z.string().optional(), // Computed from date/time pickers
  status: z.enum(['scheduled', 'in-progress', 'completed', 'cancelled']).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  assignedTo: z.string().optional(),
})

export type JobFormData = z.infer<typeof jobSchema>

