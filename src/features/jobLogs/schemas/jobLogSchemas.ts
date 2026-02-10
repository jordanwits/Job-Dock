import { z } from 'zod'

export const jobLogSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  jobId: z.string().optional(),
  contactId: z.string().optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
})

export type JobLogFormData = z.infer<typeof jobLogSchema>
