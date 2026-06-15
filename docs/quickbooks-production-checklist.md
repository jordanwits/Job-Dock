# QuickBooks Online — Production Go-Live Checklist

Everything below is what stands between today's working **sandbox** integration and real
customers paying invoices in **production**. The code is done (Phases 0–3 + the customer pay-link
UX); the remaining work is Intuit's app review and a small config flip. **Start the review early —
Intuit's assessment has a multi-week lead time and nothing in code shortcuts it.**

> Verify every Intuit-side step against the current developer portal (developer.intuit.com) — Intuit
> changes the exact screens/wording periodically. This doc maps each requirement to what JobDock
> already implements so the submission is concrete.

---

## 1. Intuit production app review (the long pole)

Intuit requires a security/technical assessment before an app may connect to **real (non-sandbox)**
QuickBooks companies. To submit you need:

- [ ] **Production app created** in the Intuit app (same app, "Production" keys tab).
- [ ] **EULA / Terms of Service URL** — public, linked from JobDock.
- [ ] **Privacy Policy URL** — public; must describe what QuickBooks data is accessed and how it's stored.
- [ ] **App name, logo, description, launch/landing URL** for the app cards.
- [ ] **Production redirect URI** registered exactly: `https://www.thejobdock.com/quickbooks/callback`
      (apex 307-redirects to www; register the www form — see `docs/quickbooks-integration.md`).
- [ ] **Scopes minimized** — we request only `com.intuit.quickbooks.accounting` and
      `com.intuit.quickbooks.payment`. Do not add scopes we don't use.
- [ ] **Security questionnaire** answered. Our implementation already satisfies the common asks:

  | Intuit asks | JobDock answer |
  | --- | --- |
  | How are OAuth tokens stored? | **AES-256-GCM encrypted at rest** in `QuickBooksConnection.accessToken/refreshToken` (`lib/quickbooks/crypto.ts`, fails closed if key missing). |
  | OAuth 2.0 + CSRF? | Authorization Code flow; signed/random `state` generated server-side and verified on callback (`lib/quickbooks/oauth.ts`, `service.connect`). |
  | HTTPS everywhere? | API Gateway + CloudFront are HTTPS-only; all Intuit calls are HTTPS. |
  | Token refresh / lifecycle? | Access token refreshed lazily near expiry (`lib/quickbooks/client.ts`); refresh tokens kept alive for idle tenants by a daily Lambda (`quickbooks-token-refresh`). |
  | Disconnect / revoke? | Owner-triggered disconnect revokes the refresh token with Intuit and clears local state (`service.disconnect`). |
  | Who can connect/manage? | **Owner-only** mutations (connect/disconnect/sync), same role check as billing; status readable by any authed user. |
  | Webhook authenticity? | Intuit HMAC-SHA256 signature verified with the verifier token before processing; events de-duped via `QuickBooksWebhookEvent` (`service.handleWebhook`). |
  | Multi-tenant isolation? | Every QB call is scoped to the tenant's `realmId`; never cross tenants. |

- [ ] **Submit for production review** and track the ticket. Budget days–weeks.

## 2. QuickBooks Payments enrollment (per tenant, required for "Pay now")

- [ ] Confirm each tenant who wants to **take** payments is **US-based** (QuickBooks Payments is US-only).
- [ ] Each tenant enrolls **their own** QuickBooks company in QuickBooks Payments (their merchant account).
- [ ] Until a tenant enrolls, their invoices still push and send, but the hosted link is the Intuit
      "coming soon" placeholder — JobDock's `isUsablePayUrl()` guard intentionally hides the **Pay Now**
      button in that state, so customers never see a dead link.

## 3. Webhooks (real-time reconciliation)

- [ ] In the Intuit app, set the **webhook endpoint** to `https://www.thejobdock.com/quickbooks/webhook`
      (routes to the data Lambda via the `{proxy+}` catch-all — no new API Gateway resource).
- [ ] Subscribe to **Invoice** and **Payment** events.
- [ ] Copy the **Webhook Verifier Token** into `QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN` (deploy env, not code).
- [ ] The daily `quickbooks-reconcile-poll` Lambda already covers anything a webhook misses.

## 4. Config flip to production (small, once review passes)

Update the deploy environment (`.env.local`, injected by `deploy-with-env.js`) and redeploy:

- [ ] `QUICKBOOKS_ENV=production`
- [ ] `QUICKBOOKS_CLIENT_ID` / `QUICKBOOKS_CLIENT_SECRET` → **production** values
- [ ] `QUICKBOOKS_REDIRECT_URI=https://www.thejobdock.com/quickbooks/callback`
- [ ] `QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN` set
- [ ] `QUICKBOOKS_TOKEN_ENC_KEY` set (keep stable — rotating it invalidates all stored tokens)
- [ ] `npm run deploy:prod --prefix infrastructure` (show the CDK diff + confirm first).
- [ ] No new DB migration is required for any of the QuickBooks phases.

## 5. Post-go-live smoke test (with one real, Payments-enrolled tenant)

- [ ] Connect a real QuickBooks company (Settings → QuickBooks).
- [ ] Send an invoice via JobDock → confirm the customer email/SMS shows **Pay Now**, and the public
      invoice page shows the **Pay Now** button.
- [ ] Pay it with a real card/ACH on the Intuit hosted page.
- [ ] Confirm the webhook flips the JobDock invoice to **paid** and inserts a `Payment{method:'quickbooks'}` row.
- [ ] Confirm the daily poll also reconciles if the webhook is delayed.

---

### Current status (2026-06-15)
- Phases 0–3 implemented, deployed to prod, verified in **sandbox** (company "Sandbox Company US ff29").
- Customer pay-link UX (public invoice page + email + SMS) implemented on `feat/quickbooks-pay-link`.
- Blocked on: **§1 production review** and **§2 Payments enrollment** — both external/operational.
