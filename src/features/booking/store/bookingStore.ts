import { create } from 'zustand'
import { servicesService } from '@/lib/api/services'
import type { Service } from '@/features/scheduling/types/service'
import type {
  AvailableSlot,
  DaySlots,
  BookingPayload,
  BookingConfirmation,
} from '../types/booking'

interface BookingState {
  // Services
  services: Service[]
  selectedService: Service | null
  
  // Availability
  availableSlots: DaySlots[]
  selectedDate: string | null
  selectedSlot: AvailableSlot | null
  
  // State
  isLoading: boolean
  error: string | null
  bookingConfirmation: BookingConfirmation | null
  
  // Actions
  loadServicesForBooking: (id?: string, isTenantId?: boolean) => Promise<void>
  selectService: (serviceId: string) => Promise<void>
  loadAvailability: (serviceId: string, startDate?: Date, endDate?: Date) => Promise<void>
  selectDate: (date: string) => void
  selectSlot: (slot: AvailableSlot | null) => void
  submitBooking: (payload: BookingPayload) => Promise<void>
  resetBooking: () => void
  clearError: () => void
}

export const useBookingStore = create<BookingState>((set, get) => ({
  services: [],
  selectedService: null,
  availableSlots: [],
  selectedDate: null,
  selectedSlot: null,
  isLoading: false,
  error: null,
  bookingConfirmation: null,

  loadServicesForBooking: async (id?: string, isTenantId: boolean = false) => {
    set({ isLoading: true, error: null })
    try {
      console.log('Loading services for booking...', { id, isTenantId })
      
      if (id) {
        if (isTenantId) {
          // Load all services for this tenant
          console.log('Loading all services for tenant:', id)
          const services = await servicesService.getAllActiveForTenant(id)
          console.log('Loaded services for tenant:', services)
          // Don't throw error - just set empty array and let UI handle it gracefully
          set({ services, isLoading: false })
        } else {
          // Load specific service by ID
          console.log('Loading specific service:', id)
          const service = await servicesService.getById(id)
          console.log('Loaded specific service:', service)
          if (!service.isActive) {
            // Set empty array instead of throwing error
            set({ services: [], isLoading: false })
          } else {
            set({ services: [service], isLoading: false })
          }
        }
      } else {
        // Load all services (requires authentication)
        const allServices = await servicesService.getAll()
        console.log('All services:', allServices)
        const activeServices = allServices.filter((s: Service) => s.isActive)
        console.log('Active services:', activeServices)
        set({ services: activeServices, isLoading: false })
      }
    } catch (error: any) {
      console.error('Failed to load services:', error)
      set({
        error: error.message || 'Failed to load services',
        isLoading: false,
      })
    }
  },

  selectService: async (serviceId: string) => {
    const { services } = get()
    const service = services.find((s) => s.id === serviceId)
    
    if (!service) {
      set({ error: 'Service not found' })
      return
    }

    console.log('Selected service:', service)
    console.log('Service availability:', service.availability)

    set({ 
      selectedService: service,
      selectedSlot: null,
      selectedDate: null,
      availableSlots: [],
    })

    // Load availability for the selected service
    await get().loadAvailability(serviceId)
  },

  loadAvailability: async (serviceId: string, startDate?: Date, endDate?: Date) => {
    set({ isLoading: true, error: null })
    try {
      console.log('Loading availability for service:', serviceId)
      const response = await servicesService.getAvailability(serviceId, startDate, endDate)
      console.log('Availability response:', response)
      console.log('Number of days with slots:', response.slots?.length || 0)
      set({ 
        availableSlots: response.slots,
        isLoading: false,
      })
    } catch (error: any) {
      console.error('Failed to load availability:', error)
      set({
        error: error.message || 'Failed to load availability',
        isLoading: false,
      })
    }
  },

  selectDate: (date: string) => {
    set({ selectedDate: date, selectedSlot: null })
  },

  selectSlot: (slot: AvailableSlot | null) => {
    set({ selectedSlot: slot })
  },

  submitBooking: async (payload: BookingPayload) => {
    const { selectedService } = get()
    
    if (!selectedService) {
      set({ error: 'No service selected' })
      return
    }

    set({ isLoading: true, error: null })
    try {
      const job = await servicesService.bookSlot(selectedService.id, payload)
      
      const confirmation: BookingConfirmation = {
        jobId: job.id,
        serviceName: selectedService.name,
        startTime: job.startTime,
        endTime: job.endTime,
        contactName: job.contactName || payload.contact.name,
        occurrenceCount: (job as any).occurrenceCount,
      }

      set({
        bookingConfirmation: confirmation,
        selectedSlot: null,
        isLoading: false,
      })
    } catch (error: any) {
      set({
        error: error.message || 'Failed to book appointment',
        isLoading: false,
      })
      throw error
    }
  },

  resetBooking: () => {
    set({
      selectedService: null,
      availableSlots: [],
      selectedDate: null,
      selectedSlot: null,
      bookingConfirmation: null,
      error: null,
    })
  },

  clearError: () => {
    set({ error: null })
  },
}))

