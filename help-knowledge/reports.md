# Reports

**Route:** `/app/reports` (admins/owners)

## Purpose

Business reporting over a date range for quotes, invoices, jobs, and **employee hours** on team accounts.

## Date ranges

Presets include:

- This month  
- Last month  
- Last 3 months  
- This year  
- Custom (start and end dates you pick)  

## Team vs single account

The page loads **billing status** to decide if the account is a **team** account (e.g. subscription tier **team** or **team-plus**, or `canInviteTeamMembers === true`). Team mode unlocks cross-user **time entry** rollups and **employee hours** style reports.

If someone expects team reports but sees single-user behavior, confirm subscription and that multiple users exist.

## Data sources

- **Job logs** (with embedded time entries)  
- **Quotes** and **Invoices** lists  
- **Time entries** via `getAll` for aggregate hours reporting  

## Tips

1. Pick the **widest date range** that still answers the question to avoid missing edge-month jobs.  
2. If numbers look low after bulk imports or edits, refresh and reselect the range.  

## Troubleshooting

- **Empty report** — No data in range; expand dates or confirm records were created in app.  
- **Hours missing for one person** — Verify that user’s time entries are saved on job logs and dates fall in range.  
- **Wrong employee list** — Team membership and user fetch must succeed; check network errors in browser dev tools if blank.  
