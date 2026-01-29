import { apiClient } from './client'

export interface OnboardingStatus {
  onboardingCompletedAt: string | null
  isCompleted: boolean
}

export const onboardingApi = {
  /**
   * Get current user's onboarding status
   */
  getStatus: async (): Promise<OnboardingStatus> => {
    const response = await apiClient.get('/onboarding')
    return response.data
  },

  /**
   * Mark onboarding as complete for current user
   */
  complete: async (): Promise<OnboardingStatus> => {
    const response = await apiClient.post('/onboarding/complete')
    return response.data
  },

  /**
   * Reset onboarding status (for testing)
   */
  reset: async (): Promise<OnboardingStatus> => {
    const response = await apiClient.post('/onboarding/reset')
    return response.data
  },
}
