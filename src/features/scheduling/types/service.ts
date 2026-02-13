export interface Service {
  id: string
  name: string
  description?: string
  duration: number // in minutes
  price?: number
  isActive: boolean
  availability: ServiceAvailability
  bookingSettings: BookingSettings
  createdAt: string
  updatedAt: string
  tenantId?: string // Included when fetched from API
}

export interface ServiceAvailability {
  workingHours: WorkingHours[]
  bufferTime?: number // minutes before/after appointments
  advanceBookingDays?: number // how many days in advance can be booked
  sameDayBooking?: boolean
}

export interface WorkingHours {
  dayOfWeek: number // 0 = Sunday, 6 = Saturday
  startTime: string // HH:mm format
  endTime: string // HH:mm format
  isWorking: boolean
}

export interface BookingSettings {
  requireConfirmation: boolean
  allowCancellation: boolean
  cancellationHours?: number // hours before appointment
  maxBookingsPerSlot?: number
  requireContactInfo: boolean
  bookingFormFields?: string[] // e.g., ['name', 'email', 'phone', 'notes']
}

export interface CreateServiceData {
  name: string
  description?: string
  duration: number
  price?: number
  isActive?: boolean
  availability: ServiceAvailability
  bookingSettings: BookingSettings
}

export interface UpdateServiceData extends Partial<CreateServiceData> {
  id: string
}

export interface ServiceBookingLink {
  serviceId: string
  serviceName: string
  publicLink: string
  embedCode?: string
}

