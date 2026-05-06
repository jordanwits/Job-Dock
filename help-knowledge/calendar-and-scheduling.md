# Calendar

**Route:** Calendar in the sidebar → `/app/scheduling`

## Purpose

Shows scheduled jobs and bookings in a calendar UI. Owners and admins use it heavily; employees also see Calendar to know where and when work is booked.

From scheduling you typically **create appointments**, adjust times, associate services, pricing, recurrence where supported, and connect work to contacts or downstream job logs.

## Relationship to Jobs

Calendar events tie to **jobs** scheduling data. Dashboard “upcoming” lists use jobs’ **start times**. Job logs can mirror flattened **startTime** / **endTime** from scheduling for Jobs list readability.

### “To be scheduled”

Work can be marked **to be scheduled** when the job log expects a Calendar appointment but timing is not set yet — check both Calendar and Jobs views.

## Recurring schedules

The product supports creating **recurring schedules** where applicable (weekly patterns, continuation of series). Exact UI labels may vary; troubleshooting: open the job/job log from Calendar, inspect series rules vs single occurrences.

If one instance is wrong vs whole series — note date of occurrence before reporting bugs.

## Tips

1. Prefer setting times in Calendar first when you need all staff to share one source of truth.  
2. If two places disagree — refresh; then open the job log bookings list.  

## Employee limitation

Employees do not manage billing or quoting from Calendar; focus is seeing schedule and interacting with assignments.
