import { create } from 'zustand'
import {
  googleCalendarApi,
  type GoogleCalendarStatus,
  type GoogleCalendarSyncMode,
} from '@/lib/api/googleCalendar'
import { getErrorMessage } from '@/lib/utils/errorHandler'

interface GoogleCalendarState {
  status: GoogleCalendarStatus | null
  loading: boolean
  /** Error surfaced next to the section's action buttons (connect-url / sync / sync-mode / load). */
  error: string | null
  loadStatus: () => Promise<void>
  /** Fetches the authorize URL then full-page redirects the browser to Google's consent screen. */
  startConnect: (syncMode: GoogleCalendarSyncMode) => Promise<void>
  /** Disconnects the current user. Throws on failure so the caller can surface a modal-local error. */
  disconnect: (removeCalendar: boolean) => Promise<void>
  updateSyncMode: (syncMode: GoogleCalendarSyncMode) => Promise<void>
  syncNow: () => Promise<void>
}

export const useGoogleCalendarStore = create<GoogleCalendarState>((set, get) => ({
  status: null,
  loading: false,
  error: null,

  loadStatus: async () => {
    set({ loading: true, error: null })
    try {
      const status = await googleCalendarApi.getStatus()
      set({ status, loading: false })
    } catch (err) {
      set({
        error: getErrorMessage(err, 'Failed to load Google Calendar status'),
        loading: false,
      })
    }
  },

  startConnect: async (syncMode: GoogleCalendarSyncMode) => {
    set({ error: null })
    try {
      const { url } = await googleCalendarApi.getConnectUrl(syncMode)
      window.location.href = url
    } catch (err) {
      set({ error: getErrorMessage(err, 'Failed to start Google Calendar connection') })
      throw err
    }
  },

  disconnect: async (removeCalendar: boolean) => {
    // Intentionally does NOT set store.error — the caller surfaces failures inside the
    // confirmation modal (project rule: modal submit errors show inside the modal).
    await googleCalendarApi.disconnect(removeCalendar)
    await get().loadStatus()
  },

  updateSyncMode: async (syncMode: GoogleCalendarSyncMode) => {
    set({ error: null })
    try {
      const status = await googleCalendarApi.updateSyncMode(syncMode)
      set({ status })
    } catch (err) {
      set({ error: getErrorMessage(err, 'Failed to update sync setting') })
      throw err
    }
  },

  syncNow: async () => {
    set({ error: null })
    try {
      await googleCalendarApi.sync()
    } catch (err) {
      set({ error: getErrorMessage(err, 'Failed to queue a sync') })
      throw err
    }
  },
}))
