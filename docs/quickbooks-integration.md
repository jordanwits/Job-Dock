# QuickBooks Online Integration — Plan & Scaffold

## Context

JobDock today owns its own Contacts, Invoices, Quotes and Payments (Prisma/PostgreSQL,
multi‑tenant). Invoices are sent by email/SMS with a public approval link, and payments are
**recorded manually** (the `Payment` table has `method`/`reference` but no real processor).
There is a Stripe integration, but it is used **only for JobDock's own SaaS subscriptions**, not
for collecting money from a tenant's clients.

This feature lets each tenant **link their own QuickBooks Online company** and then:

1. **Send real, payable invoices** to their clients (created in their QuickBooks company), and
2. **Take real payments** via **QuickBooks Payments** (Intuit‑hosted card/ACH "Pay now" link),
   with payment status flowing back into JobDock automatically.

### Decisions locked in (with the user)

| Decision | Choice |
| --- | --- |
| Payment processor | **QuickBooks Payments** — Intuit processes the money into each tenant's own merchant account. No Stripe Connect needed. |
| Source of truth / sync direction | **JobDock → QuickBooks one‑way push.** JobDock stays authoritative; we push Customers/Invoices; payment status flows back via webhook/poll. No two‑way conflict resolution. |
| Scope | **Customers + Invoices + Payments.** (Quotes→Estimates and back‑catalog import are explicitly out of scope for v1.) |

---

## What I need from you (external prerequisites)

These have **long lead times** (Intuit review can take days–weeks) — please start them early. The
code scaffold does **not** depend on them, but nothing can actually move money until they're done.

1. **Intuit Developer account + app** — create an app at <https://developer.intuit.com>.
   - Send me the **sandbox** `Client ID` and `Client Secret` first (lets us build/test end‑to‑end).
   - Later, the **production** `Client ID` / `Client Secret` (issued after app review — see #4).
2. **Redirect URI registration** — in the Intuit app, register these exact Redirect URIs (must be
   HTTPS and exact‑match). We use a **frontend** callback route:
   - Prod: `https://www.thecleandock.com/quickbooks/callback` (the app serves at **www**; the apex
     `thecleandock.com` 307-redirects to www, so register the www form)
   - Local dev: `http://localhost:3000/quickbooks/callback` (Intuit allows http only for localhost)
3. **QuickBooks Payments** — QuickBooks Payments is **US‑only**. Each tenant who wants to *take*
   payments must enroll their QuickBooks company in QuickBooks Payments (we request the
   `com.intuit.quickbooks.payment` scope at connect time). Confirm: are you and your tenants US‑based?
   If any tenant is outside the US, invoices will still send but the "Pay now" link won't be available
   to them.
4. **Production app assessment** — Intuit requires apps to pass a security/technical review before
   they can connect to **real (non‑sandbox)** QuickBooks companies. They'll ask for an EULA, privacy
   policy, the OAuth flow, and how tokens are stored. We can do all dev/testing in **sandbox** without
   this; budget time for the review before go‑live.
5. **Webhook verifier token** — once the app exists, Intuit gives a **Webhook Verifier Token**
   (for `/quickbooks/webhook` signature checks). Send it to me; it goes in the Lambda env, not code.
6. **A token-encryption key** — I'll generate a 32‑byte key for encrypting OAuth tokens at rest
   (`QUICKBOOKS_TOKEN_ENC_KEY`); it must be added to the deploy environment (`.env.local`). Confirm
   you're OK with app‑level AES‑256‑GCM encryption in the DB columns (the simplest secure option),
   vs. the heavier AWS KMS/Secrets‑Manager‑per‑tenant alternative (notes in Security below).

### New environment variables (added to deploy env / `.env.local`, injected into the data Lambda)

```
QUICKBOOKS_ENV=sandbox                 # "sandbox" | "production"
QUICKBOOKS_CLIENT_ID=...
QUICKBOOKS_CLIENT_SECRET=...
QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN=...
QUICKBOOKS_TOKEN_ENC_KEY=...           # 32-byte key, base64 (generate: openssl rand -base64 32)
QUICKBOOKS_REDIRECT_URI=https://www.thecleandock.com/quickbooks/callback  # must exactly match Intuit app
```

---

## Architecture overview

```
Tenant owner (Settings > QuickBooks)
   |  "Connect QuickBooks"
   v
GET /quickbooks/connect-url  --(backend builds Intuit authorize URL + signed state)-->  { url }
   |  browser redirects to Intuit consent screen
   v
Intuit  --(redirect)-->  https://app/quickbooks/callback?code=...&realmId=...&state=...
   |  callback page POSTs code+realmId+state
   v
POST /quickbooks/connect  --(exchange code -> access+refresh tokens; store encrypted)-->  connected
   ...
Invoice detail > "Send via QuickBooks"
   v
POST /quickbooks/sync-invoice { invoiceId }
   |  ensure QB Customer exists (map Contact),
   |  create/update QB Invoice with online payment enabled,
   |  store quickbooksInvoiceId + pay link on the JobDock Invoice
   v
Client receives Intuit invoice email/link -> pays via QuickBooks Payments
   v
POST /quickbooks/webhook (Intuit) OR daily poll
   |  mark JobDock Invoice paid/partial, create JobDock Payment(method="quickbooks")
   v
JobDock invoice shows "Paid"
```

Routing note: API Gateway has a catch‑all `{proxy+}` → data Lambda
(`infrastructure/lib/jobdock-stack.ts:670`), so **`/quickbooks/*` already routes to the handler** —
no new API Gateway resources are required. We only add env vars + the token‑refresh schedule.

---

## Data model changes (`backend/prisma/schema.prisma`)

New models:

- **`QuickBooksConnection`** (one per tenant): `realmId`, encrypted `accessToken`/`refreshToken`,
  `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `paymentsConnected`, `status`
  (`connected|error|disconnected`), `lastSyncAt`, `lastErrorMessage`, `scope`, `connectedByUserId`.
- **`QuickBooksWebhookEvent`** (idempotency, mirrors `StripeWebhookEvent`): `eventId @unique`, `realmId`.

Additive fields on existing models (all nullable, safe):

- `Tenant`  → `quickbooksConnection QuickBooksConnection?`
- `Contact` → `quickbooksCustomerId String?`
- `Invoice` → `quickbooksInvoiceId String?`, `quickbooksSyncStatus String @default("none")`,
  `quickbooksSyncedAt DateTime?`, `quickbooksInvoiceUrl String?` (Intuit pay link)
- `Payment` → `quickbooksPaymentId String?` (dedupe reconciled payments)

Migration: `cd backend && npx prisma migrate dev --name quickbooks_integration` (dev), then
`npx prisma generate`. Production applies via the existing migration Lambda flow. **No migration is
run as part of this scaffold.**

---

## Backend

New module `backend/src/lib/quickbooks/` (kept out of the 7k‑line `dataService.ts`):

- `types.ts` — shared TS types (connection, status, QBO DTOs).
- `config.ts` — sandbox/prod base URLs, scopes, OAuth endpoints, reads env.
- `crypto.ts` — AES‑256‑GCM encrypt/decrypt for tokens (`QUICKBOOKS_TOKEN_ENC_KEY`, fail‑closed).
- `oauth.ts` — build authorize URL + signed `state`, exchange code, refresh, revoke (plain `fetch`).
- `client.ts` — get tenant connection, lazily refresh near‑expiry access token, authed QBO request helper.
- `sync.ts` — map JobDock Contact→QB Customer, Invoice→QB Invoice (online payment on), reconcile payments.
- `service.ts` — orchestration used by the handler: `getStatus`, `getConnectUrl`, `connect`,
  `disconnect`, `syncInvoice`, `handleWebhook`.
- `index.ts` — barrel.

Handler wiring (`backend/src/functions/data/handler.ts`):

- **Public webhook** early‑return (before auth), mirroring the Stripe block at line 301:
  `if (event.path?.includes('/quickbooks/webhook') && POST) -> verify Intuit signature -> handleWebhook`.
- **Authenticated dispatch** inside the main `try`, mirroring `if (resource === 'billing')`:
  `if (resource === 'quickbooks')` with `id` as the action — `status` (any authed user),
  `connect-url`/`connect`/`disconnect`/`sync-invoice` (owner only, same role check as billing).

Token lifecycle:

- Access token (~1h) is refreshed **lazily** in `client.ts` on demand.
- Refresh token (~100 days, rotates each refresh) is kept alive for **inactive** tenants by a new
  scheduled Lambda `backend/src/functions/quickbooks-token-refresh/handler.ts`, run **daily** via
  EventBridge (same pattern as `cleanup-jobs`). It refreshes connections not rotated in ~7 days.

---

## Infrastructure (`infrastructure/lib/jobdock-stack.ts`)

- Add the `QUICKBOOKS_*` env vars to the **data Lambda** `environment` block (next to the Stripe vars).
- Add a `QuickBooksTokenRefreshLambda` + `events.Rule` (daily) — copy the `cleanupLambda` +
  `CleanupJobsSchedule` pattern, granting DB read/connect.
- No new API Gateway resources (covered by `{proxy+}`).

---

## Frontend

New feature `src/features/quickbooks/`:

- `types.ts` — `QuickBooksStatus`, etc.
- `store/quickbooksStore.ts` — Zustand store: `status`, `loadStatus`, `connect` (opens Intuit),
  `disconnect`, `syncInvoice`. Shared by the settings tab and the invoice panel.
- `pages/QuickBooksCallbackPage.tsx` — handles the Intuit redirect: validates `state` (CSRF),
  POSTs `code`+`realmId` to `/quickbooks/connect`, then redirects to
  `/app/settings?tab=quickbooks&connected=1`.
- `components/QuickBooksInvoicePanel.tsx` — mounts in the invoice detail: shows sync status and a
  **"Send via QuickBooks"** button; disabled with a hint when QuickBooks isn't connected.
- `index.ts` — barrel.

New API module `src/lib/api/quickbooks.ts` (mirrors `settings.ts`): `getStatus`, `getConnectUrl`,
`connect`, `disconnect`, `syncInvoice`.

New settings tab `src/features/settings/QuickBooksSection.tsx` (mirrors `BillingSection.tsx`):
connection status card, Connect / Disconnect, QB Payments status, last sync, error surface.

Wiring edits:

- `src/features/settings/SettingsPage.tsx` — add a `quickbooks` tab (`roles: ['owner']`).
- `src/App.tsx` — add public‑ish route `/quickbooks/callback` (rendered inside `ProtectedRoute` so the
  session token is present when we call `/quickbooks/connect`).
- `src/features/invoices/components/InvoiceDetail.tsx` — mount `<QuickBooksInvoicePanel invoice=… />`.

---

## End-to-end user flows

**A. Connect QuickBooks (tenant owner)**
1. Settings → QuickBooks → "Connect QuickBooks".
2. Redirect to Intuit consent (accounting + payments scopes) → approve.
3. Intuit redirects to `/quickbooks/callback` → we exchange the code, store the encrypted tokens,
   detect QB Payments capability, show "Connected".

**B. Send a payable invoice**
1. Open an invoice → "Send via QuickBooks".
2. Backend ensures the client exists as a QB Customer, creates the QB Invoice with online card/ACH
   enabled, saves `quickbooksInvoiceId` + pay link on the JobDock invoice.
3. Client gets the Intuit invoice with a "Pay now" button.

**C. Get paid + reconcile**
1. Client pays via QuickBooks Payments.
2. Intuit webhook (or daily poll) → JobDock marks the invoice paid/partial and inserts a
   `Payment{ method: "quickbooks", reference: <qbPaymentId> }`.

---

## Security

- **Tokens encrypted at rest** (AES‑256‑GCM) using `QUICKBOOKS_TOKEN_ENC_KEY`; helper fails closed if
  the key is missing (matches the `APPROVAL_SECRET` "no insecure fallback" convention).
- **CSRF on OAuth**: signed/random `state` generated server‑side, echoed back, verified on callback.
- **Owner‑only** mutations (connect/disconnect/sync) via the same role check billing uses; `status`
  is readable by any authenticated user.
- **Webhook auth**: Intuit HMAC‑SHA256 signature verified with the verifier token before processing;
  events de‑duped via `QuickBooksWebhookEvent`.
- **Multi‑tenant isolation**: every QB call is scoped by the tenant's `realmId`; never cross tenants.
- Hardening option (later): store tokens in **AWS Secrets Manager per tenant** or encrypt via **KMS**
  instead of an app‑level key. Tracked alongside the existing security‑audit backlog.

---

## Phased delivery

- **Phase 0 — Scaffold (this change):** data model, backend module skeleton + routes, infra env +
  schedule, frontend settings tab + OAuth callback + invoice panel + store/api. Compiles and renders;
  business logic marked with `TODO(quickbooks)`.
- **Phase 1 — Connect flow:** real token exchange/refresh/revoke; status + Payments detection. Test in
  sandbox.
- **Phase 2 — Invoice push:** Customer + Invoice mapping incl. taxes/line items; online payment enable;
  store pay link.
- **Phase 3 — Reconcile:** webhook handler + daily poll fallback → invoice paid/partial + Payment rows.
- **Phase 4 — Polish/prod:** error/retry UX, disconnect cleanup, Intuit app review, go‑live.

### What is a stub in Phase 0
Everything that calls the live Intuit API (`oauth.ts` token calls, `client.ts` requests, `sync.ts`
mapping, `service.handleWebhook`) is structured but throws/returns `TODO(quickbooks)` until real
credentials exist. New Prisma models are referenced via `(prisma as any)` until
`prisma generate` runs — remove those casts right after the first migration.

---

## Verification

- **Build/typecheck:** `npm run build` (frontend) and `cd backend && npx tsc --noEmit`.
- **UI:** Settings → QuickBooks renders the Connect card; an invoice shows the QuickBooks panel
  (disabled "Send via QuickBooks" until connected).
- **Sandbox E2E (after creds, Phase 1+):** connect a sandbox company; push a test invoice; simulate a
  sandbox payment; confirm JobDock flips to Paid with a `quickbooks` Payment row.
