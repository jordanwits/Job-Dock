export interface AvailableSlot {
  start: string
  end: string
}

export interface DaySlots {
  date: string
  slots: AvailableSlot[]
}

export interface AvailabilityResponse {
  serviceId: string
  slots: DaySlots[]
}

export interface BookingContact {
  id?: string
  name: string
  email: string
  phone: string
  company?: string
  notes?: string
}

export interface BookingPayload {
  startTime: string
  contact: BookingContact
  location?: string
  notes?: string
}

export interface BookingFormValues {
  name: string
  email: string
  phone: string
  company?: string
  notes?: string
}

export interface BookingConfirmation {
  jobId: string
  serviceName: string
  startTime: string
  endTime: string
  contactName: string
}

