# JobDock overview

JobDock is web software for contractors and small service businesses. You manage customers, jobs, scheduling, quotes, invoices, and time tracking in one place.

## Quick map (see also `navigation-and-roles.md`)

| Area | Sidebar label | Path |
|------|-----------------|------|
| Home | Dashboard | `/app` |
| CRM | Contacts | `/app/crm` |
| Estimates | Quotes | `/app/quotes` |
| Workspaces | Jobs | `/app/job-logs` |
| Billing documents | Invoices | `/app/invoices` |
| Schedule | Calendar | `/app/scheduling` |
| Analytics | Reports | `/app/reports` |
| Configuration | Settings | `/app/settings` |
| Reusable lines | (direct URL) | `/app/line-items` |

## Main concepts

- **Contacts** — People and companies you work with.  
- **Quotes** — Estimates (draft → sent → accepted/declined/expired).  
- **Invoices** — Bills (draft/sent/overdue/cancelled) with payment tracking.  
- **Job logs** — Day-to-day job workspace: notes, photos, time, assignments, links to quotes/invoices.  
- **Calendar** — Scheduled jobs and recurring work.  
- **Public booking** — `/book` style links for clients; reschedule via token link.  

## Employee vs admin

Employees see **Dashboard, Jobs, Calendar, Profile** only. Owners and admins see the full sidebar including Contacts, Quotes, Invoices, Reports, Settings. See `navigation-and-roles.md`.

## Getting help in the app

1. Floating **Help** button — asks how-to questions, troubleshooting, includes **Send report to engineering** (emails transcript + tenant context). Daily usage may be capped per user. See `help-chat-and-escalation.md`.  
2. **Settings → Help** — replay **Play Tutorial** (onboarding), install PWA instructions, mailto support.  
3. **Settings → Feedback** — product feedback separate from bugs.

When self-service does not suffice, prefer **Send report** for engineering triage after trying steps in **`troubleshooting-playbook.md`**.

## Knowledge bundle

Topic-specific docs in this folder: Dashboard, Contacts, Quotes, Invoices, Jobs, Calendar, public booking, Settings, Reports, saved line items, accounts/roles/billing, help chat limits, troubleshooting.
