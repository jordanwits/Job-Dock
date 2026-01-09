import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authService } from '@/lib/api/services'

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
          set({
            error: error.message || 'Login failed. Please try again.',
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
          set({
            error: error.message || 'Registration failed. Please try again.',
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
          set({
            error: error.message || 'Failed to send reset email.',
            isLoading: false,
          })
          throw error
        }
      },

      clearError: () => set({ error: null }),
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

