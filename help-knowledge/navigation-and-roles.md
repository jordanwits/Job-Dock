# Navigation, routes, and who can see what

## Main sidebar (owners and admins)

After sign-in, owners and admins see these sections in order:

| Label in app | URL path |
|--------------|-----------|
| Dashboard | `/app` |
| Contacts | `/app/crm` |
| Quotes | `/app/quotes` |
| Jobs | `/app/job-logs` |
| Invoices | `/app/invoices` |
| Calendar | `/app/scheduling` |
| Reports | `/app/reports` |
| Settings | `/app/settings` |

## Employee sidebar

Employees have a reduced menu:

- Dashboard `/app`
- Jobs `/app/job-logs`
- Calendar `/app/scheduling`
- Profile `/app/profile`

Employees cannot open Contacts, Quotes, Invoices, Reports, full Settings (company billing, branding for the business), or the saved line items manager route from the sidebar. If someone with an employee login asks where Quotes or Settings are, explain they only see Dashboard, Jobs, Calendar, and Profile; an owner should adjust their role or use an owner/admin account.

## Deep links worth knowing

- A single job log (job workspace): `/app/job-logs/:id` where `:id` is that job log’s ID.
- Saved line items catalog (catalog of reusable quote/invoice lines): `/app/line-items` — for owners/admins behind AdminRoute/BillingGuard; not listed in every sidebar snapshot but available at that URL for eligible users.

## Onboarding and tutorial

- First-time setup flow: `/app/onboarding`
- To replay the tutorial from Settings: **Settings → Help** tab → **Play Tutorial** (resets onboarding and navigates to onboarding).

## Public pages (no login)

- Client booking: `/book` or `/book/:serviceId`
- Reschedule (from link in confirmation): `/public/booking/:jobId/reschedule`
- Short SMS-style links: `/s/:code` redirects to the right destination
- Client views quote: `/public/quote/:id`
- Client approves/declines quote: `/public/quote/:id/:action`
- Client views invoice: `/public/invoice/:id`
- Client accepts/declines invoice (when used): `/public/invoice/:id/:action`

## Auth and marketing

- Login: `/auth/login`
- Sign up: `/auth/signup`
- Password reset: `/auth/reset-password`
- After Stripe billing checkout: redirects may land on **`/billing/success`** or **`/billing/cancelled`**
