/**
 * Browser-side agent loop for the CleanDock AI assistant.
 *
 * DEV ONLY: this calls OpenAI directly from the browser using a local key
 * (VITE_OPENAI_API_KEY). That key would be exposed to the client, so in
 * production this same loop should run on the backend instead — the tool
 * registry and UI stay identical.
 */
import OpenAI from 'openai'
import { toolByName, toolSchemas } from './agentTools'
import { emitDataChanged } from './dataEvents'
import { assistantApi } from '@/lib/api/assistant'

const MODEL = import.meta.env.VITE_ASSISTANT_MODEL || 'gpt-4.1-mini'
const MAX_TURNS = 8

export type ChatLine = { role: 'user' | 'assistant'; content: string }

export interface RunAssistantOptions {
  /** Prior conversation (excludes the new message). */
  history: ChatLine[]
  /** The new user message. */
  message: string
  /** Ask the user to confirm a write action. Resolve true to proceed. */
  confirmWrite: (summary: string, opts?: { destructive?: boolean }) => Promise<boolean>
  /** Optional: notified when a tool starts running (for a status line). */
  onToolActivity?: (label: string) => void
  /** The route the user is currently viewing — passed to tools (e.g. help) as a hint. */
  clientRoute?: string
}

/**
 * In local dev we can call OpenAI directly from the browser using a dev-only key
 * (VITE_OPENAI_API_KEY) for convenience. In a production build this returns false
 * — `import.meta.env.DEV` is statically replaced with `false`, so that branch is
 * compiled out and the loop always goes through the backend proxy. No key is ever
 * shipped to the client in prod.
 */
function useDirectBrowserCall(): boolean {
  return Boolean(import.meta.env.DEV) && Boolean((import.meta.env.VITE_OPENAI_API_KEY || '').trim())
}

export function isAssistantConfigured(): boolean {
  // Prod: the backend proxy holds the key, so the assistant is always available.
  // Dev: we call OpenAI directly, which needs a local VITE_OPENAI_API_KEY.
  return !import.meta.env.DEV || useDirectBrowserCall()
}

let client: OpenAI | null = null
function getClient(): OpenAI {
  const apiKey = (import.meta.env.VITE_OPENAI_API_KEY || '').trim()
  if (!apiKey) {
    throw new Error(
      'The assistant is not configured. Add VITE_OPENAI_API_KEY to your .env and restart the dev server.'
    )
  }
  if (!client) {
    client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true })
  }
  return client
}

/** Local UTC offset formatted as ISO 8601, e.g. "-07:00". */
function localOffset(now: Date): string {
  const off = now.getTimezoneOffset() // minutes behind UTC (positive = behind)
  const sign = off > 0 ? '-' : '+'
  const abs = Math.abs(off)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${sign}${hh}:${mm}`
}

function systemPrompt(clientRoute?: string): string {
  const now = new Date()
  const offset = localOffset(now)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time'
  // Local wall-clock "now" without a Z, so the model anchors on local time.
  const localNow = now.toLocaleString('sv-SE').replace(' ', 'T')
  const routeNote = clientRoute ? `\n- The user is currently viewing this screen in the app: ${clientRoute}` : ''
  return `You are CleanDock's AI assistant. CleanDock is business software for contractors (jobs, quotes, invoices, bookings, contacts, scheduling). You both answer questions about how to use CleanDock AND take real actions in the app for the user.

You can take real actions in the app by calling the provided tools. You can manage:
- Contacts (customers): list, look up, create, edit, delete.
- Jobs / appointments: list, look up, create/book, edit/reschedule, change status (e.g. mark completed or cancelled via update), delete.
- Quotes: list, look up, create, edit, send, delete.
- Invoices: list, look up, create, edit, send, delete.
- Workflows: convert an accepted quote into an invoice (convert_quote_to_invoice); record an invoice payment (record_payment: paid / partial+amount / pending).
- Services: list (to pick a service or get its duration).
Use the tools to actually get things done rather than just describing the steps.

Answering "how do I use CleanDock" questions:
- For any question about how CleanDock works — how to do something, where to find a feature, what a screen/field/status means, settings, billing, role permissions, or troubleshooting something that isn't working — ALWAYS call the search_help tool and base your answer on what it returns. Do NOT answer CleanDock product/how-to questions from memory; you don't know CleanDock's specific screens, menus, or steps, and guessing will mislead the user.
- Relay the help answer faithfully and conversationally. You may trim it to fit the question, but don't invent UI details, screen names, paths, or steps it didn't provide. If search_help doesn't have the answer, say so plainly rather than guessing.
- If the user is hitting a bug, something is broken, or they need a human, let them know they can tap "Report a problem" at the top of this window to send the details (and this conversation) to our engineering team.

Working rules:
- The user's timezone is ${tz} (UTC${offset}). The current local date and time is ${localNow}${offset}.${routeNote}
- Resolve relative phrases like "tomorrow at 2pm" against that local time, in the user's timezone.
- ALWAYS pass startTime/endTime/dates to tools as ISO 8601 with the user's local offset, e.g. a 2pm appointment is "2026-05-30T14:00:00${offset}". Never use a trailing "Z" (that means UTC and will shift the time).

Gathering required info (important):
- Every create/edit action has required fields. If the user hasn't given you everything required, ask a short, friendly question to collect ONLY the missing required pieces before calling the tool. Don't interrogate them for optional fields — leave those out unless mentioned.
- NEVER invent or guess values (names, emails, phone numbers, prices, line-item descriptions, dates). If you're missing something needed, ask.
- To act on an existing record (a customer, job, quote, invoice), first find it with the matching list_/get_ tool to get its id. If a customer doesn't exist and the user wants them, create_contact first, then proceed.
- For quotes/invoices you need a contact and at least one line item (description, quantity, unit price). When editing line items, remember that passing lineItems REPLACES them all — use get_quote/get_invoice first if you're only changing some.
- Always give a new quote or invoice a short, descriptive project title (Title Case) summarizing the work, e.g. "Kitchen Remodel" or "Drain Repair". Infer it from the line items or the user's request — don't ask just for a title, and don't put the customer's name in it.
- When booking, infer end time from the service duration (list_services) or the request; default to a 1-hour slot if unspecified.

Talking to the user — always use friendly labels, never technical ones:
- NEVER show a record's internal id to the user. Ids are the long random strings (e.g. "clx9k2j3f0001", "a1b2c3d4-...") that tools use and return; they are for your tool calls ONLY. Do not print, mention, or read them aloud — not even "id: …".
- Refer to records the way a person would: quotes and invoices by their number and project title (e.g. "Quote Q-1042 — Kitchen Remodel"), customers by name, appointments by their title and time, services by name. The tools give you these friendly fields (quoteNumber, invoiceNumber, title, contactName) — use them.
- If you ever only have an id for something, look the record up (get_quote / get_invoice / get_job / get_contact) to get its friendly label before talking about it — don't fall back to showing the id.
- Use the human-friendly status words the tools return verbatim (e.g. "Declined", "Unpaid", "In progress") — don't show raw codes like "rejected" or "pending".
- Money and dates come back already formatted (e.g. "$1,250.00"); present them as-is and write dates/times in a natural local format, never as raw ISO strings.
- When you list several records, format them as a short, scannable list (one per line) using these friendly labels — totals and status included where helpful.

Conversation flow:
- Keep it natural and low-friction: confirm the user's intent in your own words, ask only for what's truly missing, and don't make them repeat themselves — reuse what they (or earlier tool results) already gave you.
- After completing an action, confirm what happened in one short sentence using the friendly label, then offer the single most useful next step as a brief question (e.g. after creating a quote: "Want me to send it to Jane Doe?"; after converting a quote: "Want me to send the invoice?"). Don't dump a menu of options.

Other:
- Write actions require user confirmation, which the app handles automatically — briefly state what you're about to do before calling the tool. If the user declines, acknowledge it and offer alternatives.
- Deletes are permanent. Only call a delete tool when the user clearly asked to delete that specific record; make sure you have the right id (look it up first) and never delete something they didn't ask about.
- You can chain tools to complete a request (e.g. find a contact, then create their quote, then send it). Confirm each write as it comes up.
- Stay focused on CleanDock tasks. Be concise and friendly. After completing an action, confirm what happened in one or two sentences.`
}

type OpenAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam
type AssistantMessage = OpenAI.Chat.Completions.ChatCompletionMessage

/** Run one completion turn: direct OpenAI call in dev, backend proxy in prod. */
async function createCompletion(messages: OpenAIMessage[]): Promise<AssistantMessage | undefined> {
  if (useDirectBrowserCall()) {
    const completion = await getClient().chat.completions.create({
      model: MODEL,
      messages,
      tools: toolSchemas,
      tool_choice: 'auto',
      temperature: 0.3,
    })
    return completion.choices[0]?.message
  }
  const res = await assistantApi.chat({ messages, tools: toolSchemas, tool_choice: 'auto' })
  return res.message ?? undefined
}

/**
 * Run one assistant turn: may invoke multiple tools (with confirmation for
 * writes) before producing a final reply.
 */
export async function runAssistant(opts: RunAssistantOptions): Promise<{ reply: string }> {
  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt(opts.clientRoute) },
    ...opts.history.map(m => ({ role: m.role, content: m.content }) as OpenAIMessage),
    { role: 'user', content: opts.message },
  ]

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const choice = await createCompletion(messages)
    if (!choice) {
      return { reply: 'Sorry, I could not generate a reply.' }
    }

    const toolCalls = choice.tool_calls ?? []
    if (toolCalls.length === 0) {
      return { reply: choice.content?.trim() || 'Done.' }
    }

    // Record the assistant turn that requested the tool calls.
    messages.push(choice)

    for (const call of toolCalls) {
      if (call.type !== 'function') continue
      const tool = toolByName.get(call.function.name)

      let args: any = {}
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {}
      } catch {
        args = {}
      }

      const respond = (payload: unknown) =>
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(payload),
        })

      if (!tool) {
        respond({ error: `Unknown tool: ${call.function.name}` })
        continue
      }

      // Resolve a friendly, id-free summary once (it may do a lookup) and reuse
      // it for both the confirm prompt and the activity status line.
      const summary = (await tool.summarize?.(args)) || tool.name

      // Gate write actions behind user confirmation.
      if (tool.mutates) {
        const approved = await opts.confirmWrite(summary, { destructive: tool.destructive })
        if (!approved) {
          respond({ status: 'cancelled_by_user' })
          continue
        }
      }

      opts.onToolActivity?.(summary)
      try {
        const result = await tool.execute(args, { clientRoute: opts.clientRoute })
        respond({ status: 'ok', result })
        // Notify the app so calendar/list views refresh after a successful write.
        if (tool.mutates && tool.affects) {
          const entities = Array.isArray(tool.affects) ? tool.affects : [tool.affects]
          entities.forEach(emitDataChanged)
        }
      } catch (err) {
        respond({ status: 'error', error: err instanceof Error ? err.message : String(err) })
      }
    }
  }

  return {
    reply:
      "I wasn't able to finish that in a reasonable number of steps. Could you rephrase or break it into smaller parts?",
  }
}
