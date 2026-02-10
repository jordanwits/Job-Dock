import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authService } from '@/lib/api/services'
import { refreshAuth } from '@/lib/api/authApi'
import { registerSessionClearHandler, registerTokenRefreshHandler } from '@/lib/auth/sessionBridge'
import { getErrorMessage } from '@/lib/utils/errorHandler'
import { isTokenExpired } from '@/lib/utils/tokenUtils'

export interface User {
  id: string
  email: string
  name: string
  tenantId: string
  onboardingCompletedAt?: string | null
}

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
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
  refreshAccessToken: () => Promise<boolean>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  clearError: () => void
  clearSession: () => void
  checkTokenValidity: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      // Allow the API client to update auth store state without importing this module,
      // avoiding circular dependencies that can break Rollup builds on some platforms.
      registerTokenRefreshHandler(({ token, refreshToken, user }) => {
        set({
          user: (user as User | undefined) ?? get().user,
          token,
          refreshToken,
          isAuthenticated: true,
          error: null,
        })
      })

      registerSessionClearHandler(() => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        })
      })

      return {
        user: null,
        token: null,
        refreshToken: null,
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
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
          // Store token and tenant_id in localStorage for API client
          localStorage.setItem('auth_token', response.token)
          localStorage.setItem('refresh_token', response.refreshToken)
          localStorage.setItem('tenant_id', response.user.tenantId)
        } catch (error: any) {
          console.error('Login error in store:', error)
          const friendlyMessage = getErrorMessage(error, 'Login failed. Please try again.')
          set({
            error: friendlyMessage,
            isLoading: false,
            isAuthenticated: false,
          })
          // Ensure we always reset loading state, even if error handling fails
          setTimeout(() => {
            set({ isLoading: false })
          }, 100)
          throw error
        }
      },

      register: async data => {
        set({ isLoading: true, error: null })
        try {
          const response = await authService.register(data)
          set({
            user: response.user,
            token: response.token,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
          // Store token and tenant_id in localStorage for API client
          localStorage.setItem('auth_token', response.token)
          localStorage.setItem('refresh_token', response.refreshToken)
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

      refreshAccessToken: async () => {
        const currentRefreshToken = get().refreshToken || localStorage.getItem('refresh_token')

        if (!currentRefreshToken) {
          console.warn('No refresh token available')
          return false
        }

        try {
          const response = await refreshAuth(currentRefreshToken)
          set({
            user: (response.user as User | undefined) ?? get().user,
            token: response.token,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            error: null,
          })
          // Update stored tokens
          localStorage.setItem('auth_token', response.token)
          localStorage.setItem('refresh_token', response.refreshToken)
          const maybeUser = response.user as Partial<User> | undefined
          if (maybeUser?.tenantId) {
            localStorage.setItem('tenant_id', maybeUser.tenantId)
          }
          return true
        } catch (error: any) {
          console.error('Token refresh failed:', error)
          // If refresh fails, clear session
          get().clearSession()
          return false
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
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          })
          // Clear all auth tokens
          localStorage.removeItem('auth_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('tenant_id')
        }
      },

      resetPassword: async (email: string) => {
        set({ isLoading: true, error: null })
        try {
          await authService.resetPassword(email)
          set({ isLoading: false })
        } catch (error: any) {
          const friendlyMessage = getErrorMessage(
            error,
            'Failed to send reset email. Please try again.'
          )
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
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        })
        localStorage.removeItem('auth_token')
        localStorage.removeItem('refresh_token')
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
      }
    },
    {
      name: 'auth-storage',
      partialize: state => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
