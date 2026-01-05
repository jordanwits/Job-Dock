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
    startTime: apiJob.startTime,
    endTime: apiJob.endTime,
    status: apiJob.status,
    location: apiJob.location,
    notes: apiJob.notes,
    assignedTo: apiJob.assignedTo,
    createdAt: apiJob.createdAt,
    updatedAt: apiJob.updatedAt,
  }
}

interface JobState {
  jobs: Job[]
  selectedJob: Job | null
  isLoading: boolean
  error: string | null
  viewMode: 'day' | 'week' | 'month'
  currentDate: Date
  
  // Actions
  fetchJobs: (startDate?: Date, endDate?: Date) => Promise<void>
  getJobById: (id: string) => Promise<void>
  createJob: (data: CreateJobData) => Promise<void>
  updateJob: (data: UpdateJobData) => Promise<void>
  deleteJob: (id: string) => Promise<void>
  setSelectedJob: (job: Job | null) => void
  setViewMode: (mode: 'day' | 'week' | 'month') => void
  setCurrentDate: (date: Date) => void
  clearError: () => void
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  selectedJob: null,
  isLoading: false,
  error: null,
  viewMode: 'month',
  currentDate: new Date(),

  fetchJobs: async (startDate?: Date, endDate?: Date) => {
    set({ isLoading: true, error: null })
    try {
      const apiJobs = await jobsService.getAll(startDate, endDate)
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
      const newJob = normalizeJob(apiJob)
      set((state) => ({
        jobs: [...state.jobs, newJob],
        isLoading: false,
      }))
      return Promise.resolve()
    } catch (error: any) {
      set({
        error: error.message || 'Failed to create job',
        isLoading: false,
      })
      throw error
    }
  },

  updateJob: async (data: UpdateJobData) => {
    set({ isLoading: true, error: null })
    try {
      const apiJob = await jobsService.update(data.id, data)
      const updatedJob = normalizeJob(apiJob)
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
    } catch (error: any) {
      set({
        error: error.message || 'Failed to update job',
        isLoading: false,
      })
      throw error
    }
  },

  deleteJob: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await jobsService.delete(id)
      set((state) => ({
        jobs: state.jobs.filter((j) => j.id !== id),
        selectedJob:
          state.selectedJob?.id === id ? null : state.selectedJob,
        isLoading: false,
      }))
    } catch (error: any) {
      set({
        error: error.message || 'Failed to delete job',
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

  clearError: () => {
    set({ error: null })
  },
}))

