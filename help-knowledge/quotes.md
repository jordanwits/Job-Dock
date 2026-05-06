# Quotes

**Route:** `/app/quotes`

## What quotes are

Quotes are estimates you send to clients. They have line items, tax, optional discount, notes, and optional **valid until** date.

## Statuses (exact API values)

| Status | User-facing label |
|--------|-------------------|
| draft | Draft |
| sent | Sent |
| accepted | Accepted |
| rejected | Declined (stored as rejected) |
| expired | Expired |

**Pending** in conversation often means **Sent** — waiting for client response.

## Sending

You can send a quote to the client. After send, the system may record **sent via** channels such as email and/or SMS depending on configuration and contact details.

## Public client link

Clients can open the quote at **`/public/quote/:id`** (no login). Approval or decline uses paths like **`/public/quote/:id/:action`**.

If a client says the link does not work: confirm they use the full link, try another browser, and check spam. If it still fails, use **Help → Send report to engineering** with the quote ID.

## Converting to invoice

Accepted quotes are often the basis for invoices. The app tracks **converted from quote** metadata on invoices (quote number, totals, dates) when applicable.

## Line items and catalog

Reusable line items can be maintained from **Saved line items** (`/app/line-items`) for admins; speeds up building quotes.

## Troubleshooting

- **Cannot send**: Confirm contact email/phone and Settings email branding; check drafts vs sent workflow.
- **Wrong totals**: Verify line quantities, unit prices, tax rate, and discount reason fields.
- **Client declined**: Status shows Declined; optional **client decline reason** may appear if they entered one on the public page.
