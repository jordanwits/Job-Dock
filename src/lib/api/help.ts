import { apiClient } from './client'

export type HelpChatResponse = {
  sessionId: string
  reply: string
  sources: string[]
}

export type HelpSessionResponse = {
  id: string
  createdAt: string
}

export type HelpReportResponse = {
  success: boolean
  alreadySent?: boolean
}

export const helpApi = {
  createSession: async (): Promise<HelpSessionResponse> => {
    const response = await apiClient.post<HelpSessionResponse>('/help/session', {})
    return response.data
  },

  chat: async (body: {
    sessionId?: string
    message: string
    clientRoute?: string
  }): Promise<HelpChatResponse> => {
    const response = await apiClient.post<HelpChatResponse>('/help/chat', body, { timeout: 120_000 })
    return response.data
  },

  report: async (body: {
    sessionId: string
    summary?: string
    clientRoute?: string
  }): Promise<HelpReportResponse> => {
    const response = await apiClient.post<HelpReportResponse>('/help/report', body, { timeout: 60_000 })
    return response.data
  },
}
