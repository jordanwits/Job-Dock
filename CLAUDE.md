# JobDock

Multi-tenant SaaS for cleaning-business owner-operators: CRM, quotes, invoices, recurring scheduling,
online booking, job logs (photos + time tracking), reports, and Stripe/QuickBooks payments. **Prod is
LIVE with real tenants at https://thejobdock.com** (Stripe + QuickBooks in production mode) — treat it
accordingly. Stack: React 18 + TypeScript + Vite SPA hosted on Vercel; serverless AWS backend (Lambda +
API Gateway, RDS Postgres via Prisma, Cognito, S3) in us-east-1, defined with CDK. GitHub: jordanwits/Job-Dock.

## Commands

Node 20 (`.nvmrc`). Three package.json workspaces: root (frontend), `backend/`, `infrastructure/`.

- `npm run dev` — Vite dev server at http://localhost:3000 (auto-opens). Defaults to MOCK data in dev.
- `npm run build` — Vite-only build (what Vercel runs). `npm run preview` serves `dist/`.
- `npm run type-check` / `npm run build:check` — include `tsc` and FAIL at baseline (pre-existing errors,
  e.g. `src/lib/utils/teamColors.ts`). Don't chase those; don't add new ones.
- `npm run lint` / `lint:fix` (`--max-warnings 0`), `npm run format` (Prettier over `src/`).
- `npm run sync:aws:env -- --env=dev` — pulls CloudFormation outputs into `.env` + `backend/.env`.
- Backend: `cd backend` → `npm test` (Jest, minimal coverage), `npm run prisma:generate|migrate|studio`,
  `npm run ingest-help`. Backend `npm run dev` is BROKEN (points at a nonexistent `src/index.ts`);
  there is no local API server — backend code only runs as Lambdas.
- Infra: `cd infrastructure` → `npm run diff:dev | synth:dev | deploy:dev | deploy:prod`.
- No frontend test runner is configured at all.

## Architecture / layout

The SPA talks to one API Gateway; nearly all requests land in the Data Lambda, which dispatches by URL
resource segment into a service registry. Tenant isolation is row-level (`tenantId` across the 27 Prisma
models, everything hanging off `Tenant`).

- `src/` — React SPA. Feature modules in `src/features/<name>/` (assistant, auth, billing, booking, crm,
  dashboard, invoices, jobLogs, line-items, marketing, onboarding, publicApproval, quickbooks, quotes,
  reports, scheduling, settings); Zustand stores per feature; path alias `@` → `src`.
  - Routes (`src/App.tsx`): marketing `/`, public booking `/book`, public quote/invoice view + approval
    `/public/*`, short links `/s/:code`, auth `/auth/*`, authed app `/app/*`.
  - `src/lib/env.ts` — `appEnv`; data mode `mock|live`: localStorage `jobdock:data-mode` overrides
    `VITE_USE_MOCK_DATA` (default mock in dev). `src/lib/api/services.ts` switches every service between
    the live axios clients and `src/lib/mock/api.ts` (a full in-browser mock backend; logins
    `jordan@westwavecreative.com` / `demo123` and `demo@jobdock.com` / `demo123`).
  - `src/features/assistant/` — in-app tool-calling AI agent over the data services (OpenAI). Prod uses the
    backend proxy `POST /assistant/chat` (server-held `OPENAI_API_KEY`); dev-only direct browser calls need
    `VITE_OPENAI_API_KEY` in `.env.local`. See `AI_ASSISTANT_HANDOFF.md` for depth.
- `backend/` — TypeScript Lambdas. `src/functions/`: `auth`, `data` (the API), `migrate`, `cleanup-jobs`,
  `quickbooks-token-refresh`, `quickbooks-reconcile-poll`. `src/lib/dataService.ts` is the ~5,500+-line
  service monolith the data handler dispatches into; `middleware.ts` = auth context + CORS allowlist;
  `email.ts` = Resend; `helpChat.ts` = help-bot RAG; `quickbooks/` = QB sync. Schema: `prisma/schema.prisma`.
- `infrastructure/` — CDK v2, single stack `lib/jobdock-stack.ts`, per-env config in `config.ts`
  (stacks `JobDockStack-dev|staging|prod`; prod: RDS Postgres t3.micro, NAT gateway, domain thejobdock.com).
- `help-knowledge/` — markdown KB; `backend npm run ingest-help` chunks/embeds it into Postgres
  (`HelpKnowledgeChunk`, pgvector) powering the help bot and the assistant's `search_help` tool.
- `scripts/` — repo utilities (`sync-aws-env.ts`, help ingestion). `tools/aws-mcp/` — read-only AWS MCP
  server for inspecting logs/stacks/Lambda config.
- The repo root is littered with dated one-off .md/.txt/.ps1/.json session artifacts. Treat them (including
  `README.md`, which still has the abandoned navy/gold "contractor platform" branding — see `PRODUCT.md`
  for current positioning) as historical; verify against code before trusting any of them.

## Deployment

- **Frontend:** Vercel project `job-dock` (`.vercel/project.json`), configured by `vercel.json`
  (`npm run build` → `dist/`, SPA rewrite, security headers). thejobdock.com / www DNS point at Vercel
  (verified 2026-07-05). Set up as a Vercel Git integration, so pushing to GitHub deploys — the dashboard
  setting itself isn't verifiable from the repo.
- **Backend:** `npm run deploy:prod --prefix infrastructure`. That wraps `deploy-with-env.js`, which loads
  root `.env` then `.env.local` (override) and refuses prod deploys without `RESEND_API_KEY`. Lambda env
  vars are baked from your shell at synth time — NEVER run raw `cdk deploy` for prod (it deploys empty
  secrets), and note bare CDK defaults to the dev config without `--context env=prod`.
- **DB migrations:** `.\migrate.ps1 -Env prod -Action deploy` invokes the MigrationLambda
  (`run-migration-lambda.ps1 -Environment prod` is an equivalent older script). See Gotchas.
- **Full pipeline:** root `npm run deploy:prod` (`deploy-production.ps1`) = CDK → env sync → migrations →
  a vestigial S3+CloudFront frontend upload step that does NOT update the live site (users are served by
  Vercel) — treat it as dead. The standalone `deploy-frontend-prod.ps1` script and its `deploy:prod:frontend`
  npm alias were removed 2026-07-05 for being misleading.
- Secrets live in gitignored `.env.local` (`RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `OPENAI_API_KEY`,
  `TWILIO_*`, `APPROVAL_SECRET`, `PHOTO_ACCESS_SECRET`, …). Never print or commit their values.

## Conventions

- Windows dev box; ops scripts are PowerShell 5.1 (`.ps1` at repo root) — no `&&` in PowerShell commands.
- Feature-folder frontend: components/stores/types stay under their `src/features/<name>/`; shared UI in
  `src/components/`. New code must pass ESLint with zero warnings.
- New API endpoints are added by registering a service in `backend/src/lib/dataService.ts` (resource key =
  URL path segment handled by the data Lambda), not by adding Lambdas or API Gateway routes.
- The user does their own browser testing — don't run browser automation unless asked.
- Don't create status/summary .md files; the root-directory clutter is the cautionary tale.

## Gotchas / constraints

- **Migrations must be registered in TWO places:** prod applies only the hardcoded `PENDING_MIGRATIONS`
  array in `backend/src/functions/migrate/handler.ts` (tracked by name in `_prisma_migrations`);
  `backend/prisma/migrations/*.sql` is used only by local `prisma migrate dev`. A migration missing from
  the array is silently skipped in prod, and array edits require a backend redeploy before running it.
- **Email is Resend-only** (`sendEmail()` in `backend/src/lib/email.ts`, from noreply@thejobdock.com).
  There is no AWS SES prod access, and Cognito-native emails (ForgotPassword, signup verification) land in
  spam — user-facing email flows use custom tokens stored in Postgres, with password changes committed to
  Cognito via `AdminSetUserPasswordCommand`.
- Auth = Cognito user pool per env; the backend verifies JWTs via `aws-jwt-verify` in `middleware.ts`,
  which also holds the prod CORS allowlist (thejobdock.com origins).
- `app.thejobdock.com` fallback URLs in backend code do not resolve; the real public base URL comes from
  the `PUBLIC_APP_URL` Lambda env var (https://thejobdock.com).
