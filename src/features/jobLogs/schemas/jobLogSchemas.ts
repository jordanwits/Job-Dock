import { z } from 'zod'

const jobAssignmentSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.string().min(1, 'Role is required'),
  price: z.number().nullable().optional(),
})

export const jobLogSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  jobId: z.string().optional(),
  contactId: z.string().optional(),
  assignedTo: z.array(jobAssignmentSchema).optional(),
  status: z.enum(['active', 'completed', 'inactive']).optional(),
})

export type JobLogFormData = z.infer<typeof jobLogSchema>
