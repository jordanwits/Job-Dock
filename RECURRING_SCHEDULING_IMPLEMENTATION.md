# Recurring Job Scheduling Implementation

## Overview

Successfully implemented recurring job scheduling for both internal staff and public customers. Users can now create repeating schedules (weekly or monthly) that automatically generate multiple job records up-front.

## What Was Implemented

### 1. Database Schema Changes

**New Model: `JobRecurrence`**
- Stores the recurrence template and rules
- Fields: frequency, interval, count, untilDate, startTime, endTime, timezone
- Relations to Tenant, Contact, Service, and Jobs

**Updated Model: `Job`**
- Added optional `recurrenceId` field to link jobs to their recurrence series
- Added index on `recurrenceId` for efficient queries

**Migration File**: `backend/prisma/migrations/20260107000001_add_job_recurrence/migration.sql`

### 2. Backend Implementation

**File: `backend/src/lib/dataService.ts`**

**New Types:**
- `RecurrenceFrequency`: 'weekly' | 'monthly'
- `RecurrencePayload`: { frequency, interval, count?, untilDate? }

**New Functions:**
- `generateRecurrenceInstances()`: Generates array of occurrence dates/times
  - Supports weekly (every 1, 2, or 4 weeks) and monthly patterns
  - Hard limits: max 50 occurrences, max 12 months
  - Preserves time of day across occurrences

- `createRecurringJobs()`: Transaction-based recurring job creation
  - Creates JobRecurrence record
  - Generates all job instances
  - Checks for conflicts across entire series
  - Fails atomically if any conflicts found
  - Returns first job with metadata (recurrenceId, occurrenceCount)

**Updated Functions:**
- `dataServices.jobs.create()`: Now accepts optional `recurrence` in payload
  - If recurrence provided, uses `createRecurringJobs()`
  - Otherwise, creates single job as before

- `dataServices.services.bookSlot()`: Extended for public booking recurrence
  - Accepts optional `recurrence` in payload
  - Inline implementation within transaction
  - Maintains email notifications for first occurrence
  - Conflict checking respects maxBookingsPerSlot

### 3. Frontend - Internal Scheduling

**Files Modified:**
- `src/features/scheduling/types/job.ts`
- `src/features/scheduling/schemas/jobSchemas.ts`
- `src/features/scheduling/components/JobForm.tsx`

**New UI Elements in JobForm:**
- "Repeat Schedule" dropdown with options:
  - Does not repeat (default)
  - Every week
  - Every 2 weeks
  - Every 4 weeks
  - Every month
- "Number of occurrences" input (2-50, default 12)
- Preview text showing end date of series

**Features:**
- Calculates and displays series end date
- Validates recurrence parameters
- Passes recurrence to backend in job creation payload

### 4. Frontend - Public Booking

**Files Modified:**
- `src/features/booking/types/booking.ts`
- `src/features/booking/components/BookingForm.tsx`
- `src/features/booking/pages/PublicBookingPage.tsx`
- `src/features/booking/store/bookingStore.ts`

**New UI Elements in BookingForm:**
- "How often?" dropdown with options:
  - One-time only (default)
  - Every week
  - Every 2 weeks
  - Every 4 weeks
  - Every month
- "Number of visits" input (2-12, default 6)
- Preview text showing series details
- Button text updates to show visit count

**Confirmation Screen Updates:**
- Shows "First Visit" instead of "Date" for recurring bookings
- Displays "Total Visits" count
- Updated confirmation message for recurring series

## Key Features

### Conflict Detection
- Checks all occurrences in the series for conflicts
- Fails the entire operation if any conflict found
- Returns detailed error message with conflicting dates/times
- Prevents partial series creation

### Safety Limits
- Maximum 50 occurrences per series
- Maximum 12 months into the future
- Enforced at both frontend (UI limits) and backend (hard caps)

### Time Handling
- Weekly: Adds `interval * 7` days per occurrence
- Monthly: Adds `interval` months, preserving day of month
- Maintains same time of day across all occurrences
- Works with existing timezone settings in Service availability

### Backward Compatibility
- Single job creation works exactly as before
- Recurrence is optional - defaults to single job if not provided
- Existing API consumers unaffected
- Job list/calendar shows all jobs individually

## Usage Examples

### Internal Staff - Creating Recurring Job

1. Navigate to Scheduling page
2. Click "New Job"
3. Fill in job details (contact, service, date/time)
4. Select "Repeat Schedule" → "Every 2 weeks"
5. Set "Number of occurrences" → 12
6. See preview: "Will create 12 jobs through Jun 15, 2026"
7. Click "Create Job"
8. System creates 12 jobs at 2-week intervals

### Public Customer - Booking Recurring Service

1. Visit public booking page for a service
2. Select date and time slot
3. Fill in contact information
4. Select "How often?" → "Every month"
5. Set "Number of visits" → 6
6. See preview: "6 visits scheduled through Jul 7, 2026"
7. Click "Book 6 Visits"
8. Confirmation shows first visit date and total visit count

### Conflict Handling

If any occurrence conflicts with an existing job:
```
Error: Cannot create recurring schedule due to conflicts: 
2026-02-07 at 10:00 AM; 2026-03-07 at 10:00 AM; and 2 more
```

User can then:
- Adjust the start date
- Choose a different time
- Reduce the number of occurrences
- Change the recurrence pattern

## Technical Notes

### Transaction Safety
- All jobs in a series are created in a single database transaction
- If any step fails, entire operation rolls back
- No partial series can be created

### Performance
- Bulk job creation uses `Promise.all()` for parallel inserts
- Conflict checks are batched per occurrence
- Indexes on `recurrenceId`, `startTime`, `status` optimize queries

### Future Enhancements (Not Implemented)
- Edit entire series at once
- Cancel all future occurrences
- Skip specific occurrences
- More complex patterns (e.g., "first Monday of each month")
- Custom end dates instead of occurrence count
- Recurrence management UI (view/edit series)

## Testing Recommendations

1. **Weekly Pattern**: Create job with "Every week", verify 12 weekly jobs
2. **Monthly Pattern**: Create job with "Every month", verify monthly spacing
3. **Conflict Detection**: Create overlapping recurring series, verify error
4. **Limits**: Try creating 100 occurrences, verify capped at 50
5. **Public Booking**: Book recurring service, verify emails and confirmation
6. **Single Jobs**: Verify single job creation still works normally
7. **Edge Cases**: Test DST transitions, month-end dates, leap years

## Migration Steps for Production

1. **Database Migration**:
   ```bash
   # On bastion host or with DB access
   npx prisma migrate deploy
   ```

2. **Deploy Backend**:
   - Prisma client already regenerated with new schema
   - Lambda functions will automatically use updated code

3. **Deploy Frontend**:
   - Build and deploy updated React app
   - No breaking changes to existing functionality

4. **Verify**:
   - Test single job creation (existing flow)
   - Test recurring job creation (new flow)
   - Test public booking with and without recurrence

## Files Changed

### Backend
- `backend/prisma/schema.prisma` - Added JobRecurrence model, recurrenceId field
- `backend/prisma/migrations/20260107000001_add_job_recurrence/migration.sql` - Migration
- `backend/src/lib/dataService.ts` - Recurrence logic and types

### Frontend
- `src/features/scheduling/types/job.ts` - Job types with recurrence
- `src/features/scheduling/schemas/jobSchemas.ts` - Validation schemas
- `src/features/scheduling/components/JobForm.tsx` - Recurrence UI
- `src/features/booking/types/booking.ts` - Booking types with recurrence
- `src/features/booking/components/BookingForm.tsx` - Recurrence UI
- `src/features/booking/pages/PublicBookingPage.tsx` - Confirmation updates
- `src/features/booking/store/bookingStore.ts` - Store updates

## Success Criteria ✅

- [x] Database schema supports recurring jobs
- [x] Backend creates multiple jobs from recurrence rules
- [x] Backend validates conflicts across entire series
- [x] Internal scheduling UI allows setting recurrence
- [x] Public booking UI allows setting recurrence
- [x] Confirmation screens show recurrence details
- [x] Single job creation remains unchanged
- [x] No breaking changes to existing APIs
- [x] TypeScript compilation successful
- [x] All components properly typed

## Notes

- Migration file created but not yet applied to production database
- Prisma client regenerated locally
- All TypeScript errors resolved
- Ready for testing and deployment

