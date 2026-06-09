import OpenAI from 'openai'
import { ApiError } from './errors'

/**
 * Server-side proxy for the in-app AI assistant's tool-calling loop.
 *
 * The browser builds the conversation (system prompt with the user's timezone,
 * history, and tool results) and supplies the tool schemas; this just runs the
 * OpenAI completion using the server-held OPENAI_API_KEY and returns the
 * assistant message. The key never reaches the client, and the tools are still
 * executed in the browser (with the confirm-before-write gate intact).
 */

// Model is chosen server-side so the client can't request a pricier one.
const CHAT_MODEL = process.env.ASSISTANT_CHAT_MODEL || 'gpt-4.1-mini'
const MAX_MESSAGES = 80
const MAX_TOOLS = 60

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY
  if (!key?.trim()) {
    throw new ApiError('Assistant is not configured (missing API key)', 503)
  }
  return new OpenAI({ apiKey: key })
}

type ChatPayload = {
  messages?: unknown
  tools?: unknown
  tool_choice?: unknown
}

export const assistantChatService = {
  // Not a REST collection — guard accidental GETs.
  async getAll(): Promise<never> {
    throw new ApiError('Not found', 404)
  },

  async chat(_tenantId: string, _userId: string, payload: ChatPayload) {
    const messages = payload?.messages
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new ApiError('messages are required', 400)
    }
    if (messages.length > MAX_MESSAGES) {
      throw new ApiError('Conversation is too long', 413)
    }
    const tools = Array.isArray(payload?.tools) ? payload.tools : undefined
    if (tools && tools.length > MAX_TOOLS) {
      throw new ApiError('Too many tools', 400)
    }

    const openai = getOpenAI()
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      tools: tools as OpenAI.Chat.Completions.ChatCompletionTool[] | undefined,
      tool_choice: tools ? ((payload?.tool_choice as OpenAI.Chat.Completions.ChatCompletionToolChoiceOption) ?? 'auto') : undefined,
      temperature: 0.3,
      max_tokens: 1024,
    })

    return { message: completion.choices[0]?.message ?? null }
  },
}
