# Invoices

**Route:** `/app/invoices`

## Basics

Invoices bill clients after work or from accepted quotes. They include line items, tax, discount, due date, payment terms, and notes.

## Status fields

### Invoice lifecycle (`status`)

| Value | Label |
|-------|-------|
| draft | Draft |
| sent | Sent |
| overdue | Overdue |
| cancelled | Cancelled |

### Payment tracking (`paymentStatus`)

- **pending** — not fully paid  
- **partial** — paid amount tracked below full total  
- **paid** — satisfied  

### Client response (`approvalStatus`) when used

| Value | Label |
|-------|-------|
| none | No response |
| accepted | Accepted |
| declined | Declined |

Declined invoices may include an optional **client decline reason** from the public flow.

## Sending and channels

Like quotes, sending may use **email** and/or **SMS** depending on contact notification preference and data on file. After send, **sent via** may list channels used.

## Public client link

View: **`/public/invoice/:id`**  
Actions: **`/public/invoice/:id/:action`**

## Options

Invoices can include flags such as **track response** and **track payment** when those features are enabled for the document.

## Troubleshooting

- **Shows overdue**: Check due date vs today; update payment status when payment is received.
- **Payment partial**: Ensure **paid amount** reflects what the client paid if your workflow uses partial payments.
- **Branding wrong on PDF/email**: Use **Settings → Company & Branding** and **PDF Templates** / **Email Templates**.
