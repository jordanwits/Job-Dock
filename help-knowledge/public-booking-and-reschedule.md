# Public booking & reschedule

## Client booking URL

Visitors book without signing into JobDock:

- **`/book`** — general booking page  
- **`/book/:serviceId`** — landing pre-scoped to a specific service UUID/slug  

Businesses distribute this link so clients pick slots tied to configured services.

## After booking

Clients may receive confirmations by email or SMS depending on business configuration; short links may use **`/s/:code`** to expand to the right URL on mobile.

## Reschedule

If a client needs a new time, use the secure link format:

**`/public/booking/:jobId/reschedule`**

That link is usually sent from confirmation messages (email/SMS). It is **token-secured** — the client must use the link from the message, not guess an ID.

## Troubleshooting for business users

1. **Link broken or expired** — Resend from the app if available, or send a fresh booking link.  
2. **Wrong service or duration** — Fix service configuration in your Services area (where you manage bookable offerings) and re-share the link.  
3. **Double booking** — Check Calendar for conflicts; move or cancel the duplicate.  

## Troubleshooting for end clients (script for support)

- Use the original message link; do not edit the URL.  
- Try another browser or incognito if the page is blank.  
- If still stuck, the business should report with **Send report to engineering** including approximate time and service name.  
