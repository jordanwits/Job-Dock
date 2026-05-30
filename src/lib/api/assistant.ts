import type OpenAI from 'openai'
import { apiClient } from './client'

export type AssistantChatResponse = {
  /** The assistant message (may include tool_calls), or null if none. */
  message: OpenAI.Chat.Completions.ChatCompletionMessage | null
}

export const assistantApi = {
  /**
   * Run one OpenAI completion via the backend proxy. The server holds the
   * OpenAI key; the browser keeps orchestrating the loop and executing tools.
   */
  chat: async (body: {
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
    tools?: OpenAI.Chat.Completions.ChatCompletionTool[]
    tool_choice?: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption
  }): Promise<AssistantChatResponse> => {
    const res = await apiClient.post<AssistantChatResponse>('/assistant/chat', body, {
      timeout: 120_000,
    })
    return res.data
  },
}
