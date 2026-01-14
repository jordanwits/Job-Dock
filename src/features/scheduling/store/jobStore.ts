import { create } from 'zustand'
import { jobsService } from '@/lib/api/services'
import type { Job, CreateJobData, UpdateJobData } from '../types/job'

// Normalize job data from API response to match the Job interface
// The backend returns nested contact/service objects, but we need flat fields
const normalizeJob = (apiJob: any): Job => {
  // If contact info is already flattened (has contactName), return as-is
  if (apiJob.contactName) {
    return apiJob as Job
  }
  
  // Extract contact info from nested contact object if present
  const contact = apiJob.contact
  const service = apiJob.service
  
  return {
    id: apiJob.id,
    title: apiJob.title,
    description: apiJob.description,
    contactId: apiJob.contactId,
    contactName: contact 
      ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() 
      : '',
    contactEmail: contact?.email,
    contactPhone: contact?.phone,
    serviceId: apiJob.serviceId,
    serviceName: service?.name,
    quoteId: apiJob.quoteId,
    invoiceId: apiJob.invoiceId,
    recurrenceId: apiJob.recurrenceId,
    startTime: apiJob.startTime,
    endTime: apiJob.endTime,
    status: apiJob.status,
    location: apiJob.location,
    notes: apiJob.notes,
    assignedTo: apiJob.assignedTo,
    breaks: apiJob.breaks || undefined,
    createdAt: apiJob.createdAt,
    updatedAt: apiJob.updatedAt,
    occurrenceCount: apiJob.occurrenceCount,
  }
}

interface JobState {
  jobs: Job[]
  selectedJob: Job | null
  isLoading: boolean
  error: string | null
  viewMode: 'day' | 'week' | 'month'
  currentDate: Date
  jobView: 'active' | 'archived' | 'trash'
  
  // Actions
  fetchJobs: (startDate?: Date, endDate?: Date, includeArchived?: boolean, showDeleted?: boolean) => Promise<void>
  getJobById: (id: string) => Promise<void>
  createJob: (data: CreateJobData) => Promise<void>
  updateJob: (data: UpdateJobData) => Promise<void>
  deleteJob: (id: string, deleteAll?: boolean) => Promise<void>
  permanentDeleteJob: (id: string, deleteAll?: boolean) => Promise<void>
  restoreJob: (id: string) => Promise<void>
  setSelectedJob: (job: Job | null) => void
  setViewMode: (mode: 'day' | 'week' | 'month') => void
  setCurrentDate: (date: Date) => void
  setJobView: (view: 'active' | 'archived' | 'trash') => void
  confirmJob: (id: string) => Promise<void>
  declineJob: (id: string, reason?: string) => Promise<void>
  clearError: () => void
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  selectedJob: null,
  isLoading: false,
  error: null,
  viewMode: 'month',
  currentDate: new Date(),
  jobView: 'active',

  fetchJobs: async (startDate?: Date, endDate?: Date, includeArchived?: boolean, showDeleted?: boolean) => {
    set({ isLoading: true, error: null })
    try {
      const apiJobs = await jobsService.getAll(startDate, endDate, includeArchived, showDeleted)
      const jobs = apiJobs.map(normalizeJob)
      set({ jobs, isLoading: false })
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch jobs',
        isLoading: false,
      })
    }
  },

  getJobById: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const apiJob = await jobsService.getById(id)
      const job = normalizeJob(apiJob)
      set({ selectedJob: job, isLoading: false })
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch job',
        isLoading: false,
      })
    }
  },

  createJob: async (data: CreateJobData) => {
    set({ isLoading: true, error: null })
    try {
      const apiJob = await jobsService.create(data)
      
      // If this is a recurring job (has occurrenceCount > 1), refresh all jobs
      // to get all the created instances. Otherwise just add the single job.
      if (apiJob.occurrenceCount && apiJob.occurrenceCount > 1) {
        // Recurring job - refresh with a wider date range to include all instances
        // Fetch 6 months forward and 1 month back from the current view
        const { currentDate } = get()
        const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
        const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 7, 0)
        await get().fetchJobs(startDate, endDate)
      } else {
        // Single job - just add it to the state
        const newJob = normalizeJob(apiJob)
        set((state) => ({
          jobs: [...state.jobs, newJob],
          isLoading: false,
        }))
      }
      return Promise.resolve()
    } catch (error: any) {
      // Extract error data from axios response
      const errorData = error.response?.data?.error || error
      const errorMessage = errorData.message || error.message || 'Failed to create job'
      
      set({
        error: errorMessage,
        isLoading: false,
      })
      
      // Preserve the status code and conflicts for the UI layer
      const enhancedError = new Error(errorMessage) as any
      enhancedError.statusCode = errorData.statusCode || error.response?.status
      enhancedError.conflicts = errorData.conflicts
      
      throw enhancedError
    }
  },

  updateJob: async (data: UpdateJobData) => {
    console.log('🔄 Frontend: Updating job with data:', { 
      id: data.id, 
      updateAll: data.updateAll,
      hasUpdateAll: 'updateAll' in data 
    })
    set({ isLoading: true, error: null })
    try {
      const apiJob = await jobsService.update(data.id, data)
      console.log('✅ Frontend: Job update response received')
      const updatedJob = normalizeJob(apiJob)
      
      // If updating all jobs in a recurring series, refresh the entire jobs list
      if (data.updateAll) {
        const { currentDate } = get()
        const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
        const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 7, 0)
        await get().fetchJobs(startDate, endDate)
      } else {
        // Single job update - just update it in the state
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === data.id ? updatedJob : j
          ),
          selectedJob:
            state.selectedJob?.id === data.id
              ? updatedJob
              : state.selectedJob,
          isLoading: false,
        }))
      }
    } catch (error: any) {
      set({
        error: error.message || 'Failed to update job',
        isLoading: false,
      })
      throw error
    }
  },

  deleteJob: async (id: string, deleteAll?: boolean) => {
    set({ isLoading: true, error: null })
    try {
      console.log('Store: archiveJob called with id:', id, 'deleteAll:', deleteAll)
      await jobsService.delete(id, deleteAll)
      
      const now = new Date().toISOString()
      
      if (deleteAll) {
        // If archiving all, find the recurrenceId and update all jobs with that recurrenceId
        const job = get().jobs.find(j => j.id === id)
        const recurrenceId = job?.recurrenceId
        console.log('Store: Found job with recurrenceId:', recurrenceId)
        
        set((state) => {
          const updatedJobs = state.jobs.map((j) => {
            if (recurrenceId && j.recurrenceId === recurrenceId) {
              return { ...j, archivedAt: now }
            } else if (!recurrenceId && j.id === id) {
              return { ...j, archivedAt: now }
            }
            return j
          })
          return {
            jobs: updatedJobs,
            selectedJob: state.selectedJob?.id === id ? null : state.selectedJob,
            isLoading: false,
          }
        })
      } else {
        // Archive only the single job
        console.log('Store: Archiving single job')
        set((state) => ({
          jobs: state.jobs.map((j) => 
            j.id === id ? { ...j, archivedAt: now } : j
          ),
          selectedJob:
            state.selectedJob?.id === id ? null : state.selectedJob,
          isLoading: false,
        }))
      }
    } catch (error: any) {
      console.error('Store: Error archiving job:', error)
      set({
        error: error.message || 'Failed to archive job',
        isLoading: false,
      })
      throw error
    }
  },

  setSelectedJob: (job: Job | null) => {
    set({ selectedJob: job })
  },

  setViewMode: (mode: 'day' | 'week' | 'month') => {
    set({ viewMode: mode })
  },

  setCurrentDate: (date: Date) => {
    set({ currentDate: date })
  },

  setJobView: (view: 'active' | 'archived' | 'trash') => {
    set({ jobView: view })
  },

  permanentDeleteJob: async (id: string, deleteAll?: boolean) => {
    set({ isLoading: true, error: null })
    try {
      console.log('Store: permanentDeleteJob called with id:', id, 'deleteAll:', deleteAll)
      await jobsService.permanentDelete(id, deleteAll)
      
      if (deleteAll) {
        const job = get().jobs.find(j => j.id === id)
        const recurrenceId = job?.recurrenceId
        
        set((state) => ({
          jobs: recurrenceId 
            ? state.jobs.filter((j) => j.recurrenceId !== recurrenceId)
            : state.jobs.filter((j) => j.id !== id),
          selectedJob: state.selectedJob?.id === id ? null : state.selectedJob,
          isLoading: false,
        }))
      } else {
        set((state) => ({
          jobs: state.jobs.filter((j) => j.id !== id),
          selectedJob: state.selectedJob?.id === id ? null : state.selectedJob,
          isLoading: false,
        }))
      }
    } catch (error: any) {
      console.error('Store: Error permanently deleting job:', error)
      set({
        error: error.message || 'Failed to permanently delete job',
        isLoading: false,
      })
      throw error
    }
  },

  restoreJob: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const apiJob = await jobsService.restore(id)
      const restoredJob = normalizeJob(apiJob)
      set((state) => ({
        jobs: state.jobs.map((j) => j.id === id ? restoredJob : j),
        selectedJob: state.selectedJob?.id === id ? restoredJob : state.selectedJob,
        isLoading: false,
      }))
    } catch (error: any) {
      set({
        error: error.message || 'Failed to restore job',
        isLoading: false,
      })
      throw error
    }
  },

  confirmJob: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const apiJob = await jobsService.confirm(id)
      const confirmedJob = normalizeJob(apiJob)
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === id ? confirmedJob : j
        ),
        selectedJob:
          state.selectedJob?.id === id
            ? confirmedJob
            : state.selectedJob,
        isLoading: false,
      }))
    } catch (error: any) {
      set({
        error: error.message || 'Failed to confirm job',
        isLoading: false,
      })
      throw error
    }
  },

  declineJob: async (id: string, reason?: string) => {
    set({ isLoading: true, error: null })
    try {
      const apiJob = await jobsService.decline(id, { reason })
      const declinedJob = normalizeJob(apiJob)
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === id ? declinedJob : j
        ),
        selectedJob:
          state.selectedJob?.id === id
            ? declinedJob
            : state.selectedJob,
        isLoading: false,
      }))
    } catch (error: any) {
      set({
        error: error.message || 'Failed to decline job',
        isLoading: false,
      })
      throw error
    }
  },

  clearError: () => {
    set({ error: null })
  },
}))

