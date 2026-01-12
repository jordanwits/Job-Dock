import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authService } from '@/lib/api/services'
import { getErrorMessage } from '@/lib/utils/errorHandler'
import { isTokenExpired } from '@/lib/utils/tokenUtils'

export interface User {
  id: string
  email: string
  name: string
  tenantId: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (data: {
    email: string
    password: string
    name: string
    companyName: string
  }) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  clearError: () => void
  clearSession: () => void
  checkTokenValidity: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authService.login(email, password)
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
          // Store token and tenant_id in localStorage for API client
          localStorage.setItem('auth_token', response.token)
          localStorage.setItem('tenant_id', response.user.tenantId)
        } catch (error: any) {
          const friendlyMessage = getErrorMessage(error, 'Login failed. Please try again.')
          set({
            error: friendlyMessage,
            isLoading: false,
            isAuthenticated: false,
          })
          throw error
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authService.register(data)
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
          // Store token and tenant_id in localStorage for API client
          localStorage.setItem('auth_token', response.token)
          localStorage.setItem('tenant_id', response.user.tenantId)
        } catch (error: any) {
          const friendlyMessage = getErrorMessage(error, 'Registration failed. Please try again.')
          set({
            error: friendlyMessage,
            isLoading: false,
            isAuthenticated: false,
          })
          throw error
        }
      },

      logout: async () => {
        set({ isLoading: true })
        try {
          await authService.logout()
        } catch (error) {
          // Continue with logout even if API call fails
          console.error('Logout error:', error)
        } finally {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          })
          // Clear both auth token and tenant_id
          localStorage.removeItem('auth_token')
          localStorage.removeItem('tenant_id')
        }
      },

      resetPassword: async (email: string) => {
        set({ isLoading: true, error: null })
        try {
          await authService.resetPassword(email)
          set({ isLoading: false })
        } catch (error: any) {
          const friendlyMessage = getErrorMessage(error, 'Failed to send reset email. Please try again.')
          set({
            error: friendlyMessage,
            isLoading: false,
          })
          throw error
        }
      },

      clearError: () => set({ error: null }),

      clearSession: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        })
        localStorage.removeItem('auth_token')
        localStorage.removeItem('tenant_id')
      },

      checkTokenValidity: () => {
        const token = localStorage.getItem('auth_token')
        if (!token) {
          return false
        }

        // Check if token is expired (with 60 second buffer)
        if (isTokenExpired(token, 60)) {
          // Token is expired, clear session
          useAuthStore.getState().clearSession()
          return false
        }

        return true
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

