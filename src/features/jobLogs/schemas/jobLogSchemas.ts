import { z } from 'zod'

export const jobLogSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  jobId: z.string().optional(),
  contactId: z.string().optional(),
  assignedTo: z.union([z.string().array(), z.string()]).optional().transform((val) => {
    // Transform string to array for backward compatibility
    if (!val) return undefined
    if (Array.isArray(val)) return val
    if (typeof val === 'string' && val.trim() !== '') return [val]
    return undefined
  }),
  status: z.enum(['active', 'completed', 'inactive']).optional(),
})

export type JobLogFormData = z.infer<typeof jobLogSchema>
