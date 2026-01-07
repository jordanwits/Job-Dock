# Public Booking Feature

## Overview

The public booking feature allows contractors to share a link with clients so they can book services online, similar to Calendly. Clients can select from available services, view open time slots, and book appointments without needing to log in.

## Features

### For Contractors
- **Generate Booking Links**: Each service has a unique public booking link
- **Service Management**: Configure working hours, availability, and booking settings per service
- **Automatic Availability**: System automatically calculates available time slots based on:
  - Service working hours (day-specific schedules)
  - Service duration
  - Buffer time between appointments
  - Already scheduled jobs
  - Advance booking windows
- **Double Booking Prevention**: Backend validates slots atomically to prevent conflicts
- **Contact Management**: New contacts are automatically created when clients book

### For Clients (Public Booking Interface)
- **Service Selection**: Browse and select from available services
- **Visual Calendar**: Month-view calendar showing dates with availability
- **Time Slot Selection**: Choose from available time slots for selected date
- **Simple Booking Form**: Provide contact information (name, email, phone)
- **Instant Confirmation**: Immediate booking confirmation with details

## How to Use

### Setting Up Services for Booking

1. **Navigate to Scheduling** → **Services** tab
2. **Create or Edit a Service**:
   - Set the service name, description, duration, and price
   - Configure **Working Hours** for each day of the week:
     - Enable/disable specific days
     - Set start and end times
   - Set **Availability Settings**:
     - Buffer time (minutes between appointments)
     - Advance booking days (how far ahead clients can book)
     - Same-day booking toggle
   - Configure **Booking Settings**:
     - Maximum bookings per slot (default: 1 to prevent double booking)
     - Require confirmation
     - Allow cancellation
     - Required form fields
3. **Activate the Service** (ensure "Active" status is enabled)

### Sharing the Booking Link

1. Go to **Scheduling** → **Services** tab
2. Find your service and click **"Get Link"**
3. Copy the booking link that appears
4. Share this link with clients via:
   - Email
   - Text message
   - Website
   - Social media
   - Embed code (also provided)

### Client Booking Flow

When clients open the booking link:

1. **Select Service**: Choose from available services (or pre-selected if service-specific link)
2. **Choose Date**: Calendar shows all dates with available slots
3. **Select Time**: Pick from available time slots for the chosen date
4. **Enter Information**: Fill out contact details (name, email, phone)
5. **Confirm Booking**: Submit to complete the booking
6. **Confirmation Screen**: Receive immediate confirmation with appointment details

## Technical Architecture

### Backend Endpoints

#### `GET /services/:id/availability`
Returns available time slots for a service within a date range.

**Query Parameters**:
- `startDate` (optional): ISO date string for range start
- `endDate` (optional): ISO date string for range end

**Response**:
```json
{
  "serviceId": "service-uuid",
  "slots": [
    {
      "date": "2026-01-10",
      "slots": [
        {
          "start": "2026-01-10T14:00:00.000Z",
          "end": "2026-01-10T15:00:00.000Z"
        }
      ]
    }
  ]
}
```

**Availability Logic**:
1. Loads service configuration (working hours, duration, buffer time)
2. Fetches all scheduled/in-progress jobs in the date range
3. For each day:
   - Generates time slots based on working hours and service duration
   - Filters out past slots
   - Applies advance booking and same-day booking rules
   - Checks for overlapping jobs
   - Returns only slots with capacity (respects `maxBookingsPerSlot`)

#### `POST /services/:id/book`
Books a time slot and creates a job.

**Request Body**:
```json
{
  "startTime": "2026-01-10T14:00:00.000Z",
  "contact": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "(555) 123-4567",
    "company": "Acme Inc.",
    "notes": "Optional notes"
  },
  "location": "Optional location",
  "notes": "Optional job notes"
}
```

**Response**: Created job object with contact and service details

**Booking Logic** (Atomic Transaction):
1. Validates service is active
2. Calculates end time from service duration
3. Re-validates the time slot:
   - Within working hours
   - Not in the past
   - Respects booking rules
   - No conflicts with existing jobs
4. Upserts contact:
   - Finds existing contact by email
   - Creates new contact if not found
5. Creates job with "scheduled" status
6. Returns complete job data

### Frontend Structure

```
src/features/booking/
├── types/
│   └── booking.ts          # TypeScript interfaces
├── store/
│   └── bookingStore.ts     # Zustand state management
├── components/
│   ├── ServicePicker.tsx   # Service selection cards
│   ├── AvailabilityCalendar.tsx  # Calendar with time slots
│   └── BookingForm.tsx     # Contact info form
├── pages/
│   └── PublicBookingPage.tsx  # Main booking page
└── index.ts                # Exports
```

### Routes

- `/book` - Public booking page (shows all services)
- `/book/:serviceId` - Public booking page with pre-selected service

Both routes are **public** (no authentication required).

## Preventing Double Bookings

The system prevents double bookings through multiple layers:

1. **Frontend Filtering**: Only shows slots that don't conflict with existing jobs
2. **Backend Validation**: Re-checks availability during booking (atomic transaction)
3. **Database Constraints**: Service-level `maxBookingsPerSlot` setting
4. **Conflict Detection**: Checks for overlapping time ranges:
   ```
   slotStart < existingJob.endTime AND slotEnd > existingJob.startTime
   ```

Even with concurrent bookings, the atomic transaction ensures only one client can book each slot.

## Configuration Options

### Service Availability Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Working Hours | Day-specific start/end times | Mon-Fri, 9am-5pm |
| Buffer Time | Minutes between appointments | 15 minutes |
| Advance Booking Days | How far ahead clients can book | 30 days |
| Same-Day Booking | Allow bookings on current day | false |

### Booking Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Require Confirmation | Booking needs approval | false |
| Allow Cancellation | Clients can cancel | true |
| Cancellation Hours | Hours before appointment | 24 hours |
| Max Bookings Per Slot | Capacity per time slot | 1 |
| Required Form Fields | Contact info to collect | name, email, phone |

## Testing the Feature

### Manual Testing Steps

1. **Setup**:
   - Create a service with working hours configured
   - Ensure service is active
   - Note some existing jobs in the schedule

2. **Generate Link**:
   - Go to Scheduling → Services
   - Click "Get Link" on your service
   - Verify link format: `http://localhost:5173/book/{serviceId}`

3. **Test Booking Flow** (open link in browser):
   - [ ] Service appears in service picker
   - [ ] Calendar shows current month
   - [ ] Days with availability have indicator dots
   - [ ] Clicking a day shows available time slots
   - [ ] Past dates/times are disabled
   - [ ] Dates with existing jobs show fewer/no slots
   - [ ] Selecting a slot activates the booking form
   - [ ] Form validates required fields
   - [ ] Submitting creates a job
   - [ ] Confirmation screen shows correct details
   - [ ] Job appears in contractor's schedule

4. **Test Double Booking Prevention**:
   - Open the same link in two browser windows
   - Select the same time slot in both
   - Try to book simultaneously
   - Verify only one booking succeeds

5. **Test Edge Cases**:
   - [ ] Service with no working hours shows no slots
   - [ ] Inactive services don't appear
   - [ ] Booking outside working hours fails
   - [ ] Same-day booking respects setting
   - [ ] Buffer time creates gaps between appointments

## Mock Data Mode

The feature works in mock data mode for testing without a backend:

- Mock services are generated with default availability
- Slots are generated algorithmically
- Bookings are stored in memory (lost on refresh)
- All validation rules still apply

To use mock mode, ensure `VITE_USE_MOCK_DATA=true` in your `.env` file.

## Integration with Existing Features

### Scheduling Tab
- Services created in Scheduling automatically get booking links
- Jobs created via public booking appear in the calendar
- Same job/service data models used throughout

### CRM (Contacts)
- New contacts are auto-created from bookings
- Existing contacts (by email) are reused
- All contact data is preserved

### Calendar View
- Booked appointments show in Day/Week/Month views
- Filter by status (scheduled, in-progress, completed)
- Full job details accessible

## Future Enhancements

Potential improvements for the booking feature:

- [ ] Email/SMS notifications to clients
- [ ] Email confirmations to contractors
- [ ] Booking cancellation/rescheduling by clients
- [ ] Multiple contractor/crew support
- [ ] Timezone handling for different locations
- [ ] Recurring availability patterns
- [ ] Waiting list for full slots
- [ ] Payment integration
- [ ] Custom branding for booking pages
- [ ] Analytics (booking rates, popular times)

## Troubleshooting

### No slots appearing
- Check service is active
- Verify working hours are configured
- Ensure advance booking window hasn't expired
- Check for conflicting jobs blocking all slots

### Booking fails with "slot no longer available"
- Another client booked simultaneously (expected behavior)
- Refresh availability and try another slot

### Service not showing in booking page
- Verify service `isActive` is true
- Check service has availability configured
- Ensure availability settings allow future bookings

## API Reference

See the full API documentation in the plan file or the backend data service implementation at:
- `backend/src/lib/dataService.ts` (service methods)
- `backend/src/functions/data/handler.ts` (route handling)

