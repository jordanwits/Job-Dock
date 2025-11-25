import { z } from 'zod'

const workingHoursSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
  isWorking: z.boolean(),
})

const availabilitySchema = z.object({
  workingHours: z.array(workingHoursSchema).length(7, 'Working hours must be set for all 7 days'),
  bufferTime: z.number().min(0).optional(),
  advanceBookingDays: z.number().min(1).optional(),
  sameDayBooking: z.boolean().optional().default(false),
})

const bookingSettingsSchema = z.object({
  requireConfirmation: z.boolean().optional().default(false),
  allowCancellation: z.boolean().optional().default(true),
  cancellationHours: z.number().min(0).optional(),
  maxBookingsPerSlot: z.number().min(1).optional(),
  requireContactInfo: z.boolean().optional().default(true),
  bookingFormFields: z.array(z.string()).optional(),
})

export const serviceSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  description: z.string().optional(),
  duration: z.number().min(15, 'Duration must be at least 15 minutes').multipleOf(15, 'Duration must be in 15-minute increments'),
  price: z.number().min(0).optional(),
  isActive: z.boolean().optional().default(true),
  availability: availabilitySchema,
  bookingSettings: bookingSettingsSchema,
})

export type ServiceFormData = z.infer<typeof serviceSchema>

