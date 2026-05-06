# Jobs (Job logs)

**List:** `/app/job-logs`  
**Detail/workspace:** `/app/job-logs/:id`

Job logs are the **workspace** for a piece of work: notes, schedule linkage, contacts, assignments, photos, time entries, and links to quotes/invoices where applicable.

## Job log status (`status`)

Exact values:

- **active** — ongoing  
- **completed** — finished  
- **inactive** — not active (the UI sometimes describes archived-style states; dashboard may label creatively but storage uses these three)

Pinned jobs: there is **pinnedAt** dashboard behavior — “pin” surfaces important logs on Dashboard.

## Time entries

Labor is tracked with **time entries**: start/end time, optional break minutes, notes, hourly rate hints. Entries belong to job logs and optionally show user attribution.

Employees use Jobs and Calendar primarily to interact with assignments and logging time assigned to them.

## Photos and markup

Photos can attach to job logs with optional **notes**. Some builds support image **markup** (pen/highlighter strokes) stored with the photo metadata.

If uploads fail: check connectivity, image size/format, retry after refresh. Persisting failures → Send report.

## Assignments (`assignedTo`)

Jobs can assign team members with **role**, optional **pay type** (**job** or **hourly**), hourly rate or job price as configured.

If an employee cannot see another user on a picker, the UI may expose **assignedToUsers** narrowed lists — escalation may be role or permission related.

## Bookings on a job log

Multiple **bookings** can exist under a job log with status, optional service metadata, pricing, linkage to underlying **quoteId**/**invoiceId**, and **to be scheduled** flag.

Primary booking timing may also flatten to **startTime** / **endTime** / **bookingStatus** on the job log summary for Calendar alignment.

## Linking Quotes and invoices

Job logs store optional **quoteId** and **invoiceId** linking back to CRM documents where the workflow created that association.

## Troubleshooting

1. Confirm you are on the correct job (**Jobs** → open the row → detail URL).  
2. If Calendar shows wrong time, open that job log and bookings; reconcile **startTime** vs booking records.  
3. **Employees** lacking access to a job: ensure they appear in assignments and tenant access model.  
