import { create } from 'zustand'
import { jobLogsService, timeEntriesService } from '@/lib/api/services'
import type { JobLog, CreateJobLogData, TimeEntry } from '../types/jobLog'

interface JobLogState {
  jobLogs: JobLog[]
  selectedJobLog: JobLog | null
  isLoading: boolean
  error: string | null

  fetchJobLogs: () => Promise<void>
  getJobLogById: (id: string) => Promise<void>
  createJobLog: (data: CreateJobLogData) => Promise<JobLog>
  updateJobLog: (id: string, data: Partial<CreateJobLogData>) => Promise<void>
  deleteJobLog: (id: string) => Promise<void>
  uploadPhoto: (jobLogId: string, file: File) => Promise<void>
  deletePhoto: (jobLogId: string, photoId: string) => Promise<void>
  updatePhoto: (
    jobLogId: string,
    photoId: string,
    data: {
      notes?: string
      markup?: {
        strokes?: Array<{
          tool: 'pen' | 'highlighter'
          color: string
          opacity: number
          width: number
          points: Array<{ x: number; y: number }>
        }>
      }
    }
  ) => Promise<void>
  createTimeEntry: (data: { jobLogId: string; startTime: string; endTime: string; breakMinutes?: number; notes?: string }) => Promise<TimeEntry>
  updateTimeEntry: (id: string, data: Partial<{ startTime: string; endTime: string; breakMinutes?: number; notes?: string }>) => Promise<void>
  deleteTimeEntry: (id: string) => Promise<void>
  setSelectedJobLog: (jobLog: JobLog | null) => void
  clearError: () => void
}

export const useJobLogStore = create<JobLogState>((set, get) => ({
  jobLogs: [],
  selectedJobLog: null,
  isLoading: false,
  error: null,

  fetchJobLogs: async () => {
    set({ isLoading: true, error: null })
    try {
      const jobLogs = await jobLogsService.getAll()
      set({ jobLogs, isLoading: false })
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to fetch jobs',
        isLoading: false,
      })
    }
  },

  getJobLogById: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const jobLog = await jobLogsService.getById(id)
      set({ selectedJobLog: jobLog, isLoading: false })
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to fetch job',
        isLoading: false,
      })
    }
  },

  createJobLog: async (data: CreateJobLogData) => {
    set({ isLoading: true, error: null })
    try {
      const newJobLog = await jobLogsService.create(data)
      set(state => ({
        jobLogs: [newJobLog, ...state.jobLogs],
        isLoading: false,
      }))
      return newJobLog
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to create job',
        isLoading: false,
      })
      throw error
    }
  },

  updateJobLog: async (id: string, data: Partial<CreateJobLogData>) => {
    set({ isLoading: true, error: null })
    try {
      const updatedJobLog = await jobLogsService.update(id, data)
      set(state => ({
        jobLogs: state.jobLogs.map(j => (j.id === id ? updatedJobLog : j)),
        selectedJobLog: state.selectedJobLog?.id === id ? updatedJobLog : state.selectedJobLog,
        isLoading: false,
      }))
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to update job',
        isLoading: false,
      })
      throw error
    }
  },

  deleteJobLog: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await jobLogsService.delete(id)
      set(state => ({
        jobLogs: state.jobLogs.filter(j => j.id !== id),
        selectedJobLog: state.selectedJobLog?.id === id ? null : state.selectedJobLog,
        isLoading: false,
      }))
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to delete job',
        isLoading: false,
      })
      throw error
    }
  },

  uploadPhoto: async (jobLogId: string, file: File) => {
    set({ isLoading: true, error: null })
    try {
      await jobLogsService.uploadPhoto(jobLogId, file)
      await get().getJobLogById(jobLogId)
      set({ isLoading: false })
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to upload photo',
        isLoading: false,
      })
      throw error
    }
  },

  deletePhoto: async (jobLogId: string, photoId: string) => {
    set({ isLoading: true, error: null })
    try {
      await jobLogsService.deletePhoto(jobLogId, photoId)
      // Optimistically remove the photo locally so the UI updates immediately,
      // even if a refetch is delayed or served stale by an intermediary.
      set(state => ({
        selectedJobLog:
          state.selectedJobLog?.id === jobLogId
            ? {
                ...state.selectedJobLog,
                photos: (state.selectedJobLog.photos ?? []).filter(p => p.id !== photoId),
              }
            : state.selectedJobLog,
        jobLogs: state.jobLogs.map(j =>
          j.id === jobLogId
            ? {
                ...j,
                photos: (j.photos ?? []).filter(p => p.id !== photoId),
              }
            : j
        ),
      }))

      await get().getJobLogById(jobLogId)
      set({ isLoading: false })
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to delete photo',
        isLoading: false,
      })
      throw error
    }
  },

  updatePhoto: async (jobLogId: string, photoId: string, data) => {
    set({ isLoading: true, error: null })
    try {
      await jobLogsService.updatePhoto(jobLogId, photoId, data)
      await get().getJobLogById(jobLogId)
      set({ isLoading: false })
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to update photo',
        isLoading: false,
      })
      throw error
    }
  },

  createTimeEntry: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const entry = await timeEntriesService.create(data)
      if (get().selectedJobLog?.id === data.jobLogId) {
        await get().getJobLogById(data.jobLogId)
      }
      set({ isLoading: false })
      return entry
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to create time entry',
        isLoading: false,
      })
      throw error
    }
  },

  updateTimeEntry: async (id: string, data, jobLogId?: string) => {
    set({ isLoading: true, error: null })
    try {
      await timeEntriesService.update(id, data)
      const logId = jobLogId || (await timeEntriesService.getById(id))?.jobLogId
      if (logId && get().selectedJobLog?.id === logId) {
        await get().getJobLogById(logId)
      }
      set({ isLoading: false })
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to update time entry',
        isLoading: false,
      })
      throw error
    }
  },

  deleteTimeEntry: async (id: string, jobLogId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const logId = jobLogId ?? (await timeEntriesService.getById(id))?.jobLogId
      await timeEntriesService.delete(id)
      if (logId && get().selectedJobLog?.id === logId) {
        await get().getJobLogById(logId)
      }
      set({ isLoading: false })
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to delete time entry',
        isLoading: false,
      })
      throw error
    }
  },

  setSelectedJobLog: (jobLog: JobLog | null) => {
    set({ selectedJobLog: jobLog })
  },

  clearError: () => {
    set({ error: null })
  },
}))
