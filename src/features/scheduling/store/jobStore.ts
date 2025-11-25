import { create } from 'zustand'
import { jobsService } from '@/lib/api/services'
import type { Job, CreateJobData, UpdateJobData } from '../types/job'

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
      const jobs = await jobsService.getAll(startDate, endDate)
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
      const job = await jobsService.getById(id)
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
      const newJob = await jobsService.create(data)
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
      const updatedJob = await jobsService.update(data.id, data)
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

