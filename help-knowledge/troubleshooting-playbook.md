# Troubleshooting playbook

Use this as a **first-response** guide. Always suggest a **page refresh** once before deep steps.

## General

1. Hard refresh the page (Ctrl+F5 on Windows) or clear cache if UI is frozen.  
2. Confirm correct **user** and **tenant** (account).  
3. Check **Settings → Company & Branding** and **Email/PDF templates** before assuming outbound issues are bugs.

## Quotes or invoices not sending

1. Contact has correct **email** and/or **phone** and notification preference (`email`, `sms`, or `both`).  
2. Document is **Sent** actually triggered (vs left draft).  
3. Spam/junk folder for client.  
4. If template variables look broken — review **Email Templates**.  
5. Still broken → **Send report to engineering** with document ID and channel tried.

## Client public link problems

1. Copy full URL including path after domain.  
2. Try incognito / different browser.  
3. Confirm document still exists and was sent.  
4. Escalate with link (redact token if pasting publicly) and quote/invoice ID.

## Calendar vs Jobs time mismatch

1. Open **Calendar** event and **Jobs** detail for same work.  
2. Check **bookings** array on job log vs flattened start/end.  
3. **To be scheduled** flag — may mean no fixed time yet.  
4. If recurring — note whether bad instance vs whole series.

## Employee cannot see Contacts / Quotes / Invoices / Settings

**Expected:** employee role hides those areas. Answer: use admin/owner account or change role with an owner.

## Booking / reschedule

1. Client must use **exact** link from email/SMS including tokens.  
2. Use `/book` or service-specific `/book/:serviceId` for new bookings.  
3. Reschedule path: `/public/booking/:jobId/reschedule` from provided link only.

## Reports look empty or wrong

1. Widen **date range** preset.  
2. Confirm **team** subscription if expecting other users’ hours.  
3. Fetch errors — retry; if persistent, report with browser console errors if user can capture.

## Photos or files fail

1. Network.  
2. File size/format.  
3. Retry after refresh.  
4. Persisting → report with approximate file size and browser.

## Billing / Stripe return

After checkout, landing query params may flip Settings to Billing tab — if stuck, reload `/app/settings` and open **Billing & Subscription** manually.
