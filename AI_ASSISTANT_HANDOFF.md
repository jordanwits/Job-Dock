# AI Assistant — Handoff

Status as of 2026-05-29. This document hands off the in-app **agentic AI assistant** feature so another agent (or developer) can pick up where we left off.

---

## 1. What this feature is

An in-app assistant that **drives the app** for the user via natural language — it creates/edits/deletes contacts, jobs/appointments, quotes, and invoices, plus runs workflows (convert quote→invoice, record payment). It's a **tool-calling agent**: the LLM decides which action(s) to take and our code executes them against the existing API services.

It **also answers "how do I use JobDock" questions** — as of 2026‑05‑29 the standalone support help chat was **merged into this assistant**. The old `HelpChatWidget` is gone; the assistant now exposes a `search_help` tool that queries the existing backend help knowledge base (`backend/src/lib/helpChat.ts` RAG over `help_knowledge_chunks`) via `src/lib/api/help.ts`, and the **Report a problem** flow (escalate the conversation to engineering) lives in the assistant window. There is now **one launcher** (bottom‑right).

---

## 2. Where the code lives

All new code is under `src/features/assistant/`:

| File | Purpose |
|---|---|
| `agentTools.ts` | Tool registry. Each tool wraps an existing data service (`contactsService`, `jobsService`, `quotesService`, `invoicesService`, `servicesService`). Because those services auto-switch mock/live, the tools work in **both** modes. Write tools are flagged `mutates`; deletes `destructive`; each declares `affects` (which store to refresh). |
| `assistantClient.ts` | Browser-side OpenAI tool-calling **agent loop**. Builds the system prompt (incl. timezone), runs the multi-step loop, gates writes behind `confirmWrite`, and emits `data-changed` after successful writes. |
| `AssistantWidget.tsx` | Chat UI (modal + composer). Renders the confirm card (red/destructive variant for deletes) **and the "Report a problem" panel** (optional note → `helpApi.report`, which emails the conversation + note to engineering). Composer has a **mic button (voice input)** that dictates into the textarea. Threads the current route into `runAssistant` as `clientRoute`. |
| `useSpeechToText.ts` | Voice input hook over the browser **Web Speech API** (`SpeechRecognition`). No key/backend — runs in-browser. Returns `isSupported` (button hides on unsupported browsers like Firefox), `isListening`, `start`/`stop`. Dictates the cumulative transcript into the input (user reviews before sending). Maps permission/capture errors to friendly messages. Possible upgrade: swap to OpenAI Whisper (MediaRecorder → transcription) for better accuracy / universal support, at per-use cost. |
| `dataEvents.ts` | Tiny event bus: `emitDataChanged(entity)` / `onDataChanged(handler)`. |
| `DataRefreshListener.tsx` | Mounted in `AppLayout`; on `data-changed` it refetches the matching Zustand store so calendar/list views update with no reload. |

Wiring: `src/components/layout/AppLayout.tsx` mounts `<AssistantWidget enabled={!!user} />` and `<DataRefreshListener />` (the old `HelpChatWidget` mount was removed). `agentTools.ts`'s `search_help` and the report panel both reuse `src/lib/api/help.ts` → the backend `/help/*` routes.

---

## 3. Config / how to run it

- **LLM key:** `VITE_OPENAI_API_KEY` in **`.env.local`** (gitignored, sync-script-safe, machine-local). DEV ONLY — see security note below.
- **Model:** defaults to `gpt-4.1-mini`; override with `VITE_ASSISTANT_MODEL` (e.g. `gpt-4.1-nano` cheaper, `gpt-4.1` stronger).
- `isAssistantConfigured()` gates the UI; with no key the widget shows a setup notice.

### Running locally in mock mode (no AWS backend)
- Set `VITE_USE_MOCK_DATA=true` (in `.env.local` to survive `npm run sync:aws:env`), or `localStorage['jobdock:data-mode']='mock'`.
- Login: `jordan@westwavecreative.com` / `demo123` (hardcoded in `src/lib/mock/api.ts`). Routes: login `/auth/login`, dashboard `/app`.
- Onboarding gate: the mock user has no `onboardingCompletedAt`, so `/app` redirects to `/app/onboarding`. To reach the dashboard, complete onboarding or patch the persisted `auth-storage` user with an `onboardingCompletedAt` timestamp.

---

## 4. Tools currently implemented (~24)

- **Help / how-to:** `search_help` — answers product/how-to/troubleshooting questions by calling the backend help RAG endpoint (`helpApi.chat`) and grounding the reply in the knowledge base. Read-only; the system prompt forces the model to route any "how do I / where is / why isn't this working" question through it instead of guessing JobDock UI details.
- **Contacts:** list, get, create, update, **delete**
- **Jobs/appointments:** list, get, create (`create_appointment`), update/reschedule (`update_appointment`, also changes status), **delete**
- **Quotes:** list, get, create, update, send, **delete**
- **Invoices:** list, get, create, update, send, **delete**
- **Workflows:** `convert_quote_to_invoice` (copies line items, marks quote accepted), `record_payment` (paid / partial+amount / pending)
- **Services:** list

Behavior enforced by the system prompt: ask only for **missing required** fields, never invent values, look up a record's id before editing, `lineItems` on update **replaces** all items, deletes are permanent (confirm the right id), times use the user's **local offset** (never `Z`), and new quotes/invoices always get a short Title-Case **project title** (not the customer name).

---

## 5. Supporting fixes made along the way (gated to mock mode where relevant)

1. **Mock session persistence** — `SessionMonitor.tsx` and the `apiClient` response interceptor (`src/lib/api/client.ts`) used to clear the session in mock mode (token refresh / non-mocked endpoint 500s). Both now early-return when `appEnv.isMock`. **No effect on live/production.**
2. **Mock quotes/invoices persistence** — `mockQuotesService`/`mockInvoicesService` `create`/`update`/`delete` didn't call `saveMockStorage()`, so they vanished on reload. Fixed.
3. **Mock title/contact fields** — mock quote/invoice `create` now persist `title`; quote `create` now also sets `contactName`/`contactEmail`/`contactCompany` (was missing entirely).

---

## 6. Verified (real LLM, mock data, via browser preview)

- Read query (list_jobs), tool calling, confirm-before-write gate.
- Timezone correctness (2pm stays 2pm local).
- Chained multi-write (create contact → create invoice), each confirmed separately.
- Auto-refresh: booked/deleted an appointment and the calendar updated with no reload.
- Destructive delete: red confirm card, deletion persisted + view refreshed.
- Workflows: quote → invoice conversion (quote marked accepted) → record payment (marked paid).
- Titles: AI-created quote shows "Garbage Disposal Repair" + contact name in the Quotes list.

---

## 7. Known gaps / next steps

- **Production backend route — DONE (2026-05-30).** The OpenAI call now runs server-side via a backend proxy so the key never ships to the client:
  - `backend/src/lib/assistantChat.ts` (`assistantChatService.chat`) runs one OpenAI completion with the server-held `OPENAI_API_KEY` (same key the help bot uses — no new secret), model fixed server-side (`ASSISTANT_CHAT_MODEL` || `gpt-4.1-mini`). Registered as `assistant` in `dataService.ts`; routed at `POST /assistant/chat` in the data handler (auth-gated via `extractContext` + tenant user lookup, mirroring the help route).
  - `src/lib/api/assistant.ts` (`assistantApi.chat`) is the browser client for that route.
  - `assistantClient.ts` now calls `createCompletion()`, which uses the **backend proxy in prod** and only falls back to the **direct browser OpenAI call in dev** (`useDirectBrowserCall()` = `import.meta.env.DEV && VITE_OPENAI_API_KEY`). The dev branch is compiled out of prod builds, so no key can ship. The tool loop, confirm-before-write gate, tool execution, and voice input all stay client-side and unchanged.
  - `isAssistantConfigured()` is now `true` in any prod build (proxy holds the key); in dev it still requires a local `VITE_OPENAI_API_KEY`.
  - Possible follow-up: add a per-user daily rate limit on `/assistant/chat` (reuse the `helpChatDailyUsage` pattern) — currently auth-gated but unmetered.
- **Convert metadata in mock:** `convertedFromQuoteNumber` isn't persisted by mock `invoicesService.create` (it builds the object explicitly). Cosmetic-only in mock; the live backend stores it.
- **Pre-fix demo records:** quotes/invoices created before the title fix (e.g. QT-2026-001/002, INV-2026-001/002) have no title — ignore or delete.
- **Possible enhancements:** streaming responses; richer confirm cards (full line-item preview); delete confirmation requiring the record name; auto-look-up before asking; more entities (job logs, time entries, services CRUD, team assignment).

---

## 8. Useful context

- Data services + mock/live switch: `src/lib/api/services.ts` (`appEnv.isMock`), `src/lib/env.ts`.
- Types: `src/features/{crm,scheduling,quotes,invoices}/types/*.ts`.
- Stores (refreshed by the listener): `useContactStore`, `useJobStore`, `useQuoteStore`, `useInvoiceStore`, `useServiceStore`.
- `npm run type-check` has **pre-existing** errors in `src/lib/mock/api.ts` and `src/lib/utils/teamColors.ts` unrelated to this feature; the assistant files are clean. Vite dev does not block on them.
