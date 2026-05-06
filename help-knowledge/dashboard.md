# Dashboard

The Dashboard (`/app`) is the overview after login.

## What it shows

- **Quotes** (admins): summary counts by status — draft, sent (shown as pending in some metrics), accepted, rejected/declined. Recent quote activity lists the latest quotes.
- **Invoices** (admins): load with other financial data similar to quotes.
- **Upcoming appointments**: built from calendar jobs (`/app/scheduling`) that have start times; used to show what is booked next.
- **Job logs**: list of Jobs (workspace records) including time-derived dates when hours were logged.

## Roles

Employees see appointments and job log sections that apply to them. Admins and owners additionally see quotes and invoices blocks on the dashboard.

## Troubleshooting

- **Empty widgets**: Confirm data exists in Contacts, Quotes, Invoices, or Calendar respectively. Employees will not quote/invoice widgets at all — that is normal.
- **Stale numbers**: Refresh the page. Navigate away and back to `/app`.
