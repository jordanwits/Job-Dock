import { apiClient } from './client'

export interface EarlyAccessRequest {
  id: string
  name: string
  email: string
  approvedAt: string | null
  approvedBy: string | null
  createdAt: string
  updatedAt: string
}

export const earlyAccessApi = {
  /**
   * Get all early access requests (admin only)
   */
  getRequests: async (): Promise<EarlyAccessRequest[]> => {
    const response = await apiClient.get('/early-access/requests')
    return response.data
  },

  /**
   * Approve an early access request (admin only)
   */
  approve: async (emailOrRequestId: string): Promise<EarlyAccessRequest> => {
    const payload = emailOrRequestId.includes('@')
      ? { email: emailOrRequestId }
      : { requestId: emailOrRequestId }

    const response = await apiClient.post('/early-access/approve', payload)
    return response.data
  },

  /**
   * Delete an early access request (admin only)
   */
  delete: async (requestId: string): Promise<void> => {
    await apiClient.delete('/early-access/delete', {
      data: { requestId },
    })
  },
}
