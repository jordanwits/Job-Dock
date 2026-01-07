# Booking Confirmation Emails & Require Confirmation Feature

## Overview

The booking system now includes comprehensive email notifications and an optional confirmation workflow. This allows contractors to:
- Send automatic confirmation emails to clients
- Require manual approval for bookings before they're confirmed
- Receive notifications when clients book services
- Confirm or decline booking requests from the scheduling dashboard

## Features Implemented

### 1. Email Notifications

**For Clients:**
- **Instant confirmation** (when `requireConfirmation` is false):
  - Email sent immediately after booking
  - Includes service details, date/time, and location
- **Pending confirmation** (when `requireConfirmation` is true):
  - Email acknowledges receipt of booking request
  - Explains contractor will confirm shortly
- **Booking confirmed** (after contractor approves):
  - Email confirms the approved booking
- **Booking declined** (if contractor declines):
  - Email explains the decline with optional reason

**For Contractors:**
- **New booking notification** (always sent):
  - Includes client contact information
  - Shows requested service and time slot
  - Indicates if confirmation is required
  - Provides link to dashboard for management

### 2. Pending Confirmation Workflow

When a service has `requireConfirmation` set to `true`:

1. **Client books a time slot**
   - Job is created with status `'pending-confirmation'`
   - Client receives "request received" email
   - Contractor receives notification email

2. **Contractor reviews the booking**
   - Pending bookings appear with orange badge in calendar
   - Opening the job shows **Confirm** and **Decline** buttons

3. **Contractor takes action**:
   - **Confirm**: Job status → `'scheduled'`, client gets confirmation email
   - **Decline**: Job status → `'cancelled'`, client gets decline email with optional reason

## Backend Implementation

### Email Service (`backend/src/lib/email.ts`)

**Core Function:**
```typescript
sendEmail(payload: EmailPayload): Promise<void>
```

**Behavior:**
- **In dev** (`SES_ENABLED !== 'true'`): Logs emails to console
- **In staging/prod** (`SES_ENABLED === 'true'`): Sends via AWS SES

**Email Templates:**
- `buildClientConfirmationEmail()` - Instant booking confirmation
- `buildClientPendingEmail()` - Pending confirmation acknowledgment
- `buildClientBookingConfirmedEmail()` - Approved booking notification
- `buildClientBookingDeclinedEmail()` - Declined booking notification
- `buildContractorNotificationEmail()` - New booking alert for contractor

### Data Service Methods

**`dataServices.services.bookSlot()`** (updated):
- Sets job status based on `service.bookingSettings.requireConfirmation`
- Sends appropriate email to client (instant or pending)
- Sends notification to contractor (if email provided)

**`dataServices.jobs.confirm()`** (new):
- Validates job status is `'pending-confirmation'`
- Updates status to `'scheduled'`
- Sends confirmation email to client
- Returns updated job

**`dataServices.jobs.decline()`** (new):
- Validates job status is `'pending-confirmation'`
- Updates status to `'cancelled'`
- Optionally stores decline reason in notes
- Sends decline email to client
- Returns updated job

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/services/:id/book` | POST | Book a time slot (sends booking emails) |
| `/jobs/:id/confirm` | POST | Confirm a pending booking |
| `/jobs/:id/decline` | POST | Decline a pending booking (optional `reason` in body) |

## Frontend Implementation

### Job Status Types

Added new status: `'pending-confirmation'`

**Visual indicators:**
- **Color**: Orange
- **Badge**: "Pending Confirmation"
- **Calendar**: Orange border and background

### Updated Components

**`JobDetail.tsx`:**
- Shows Confirm/Decline buttons when `status === 'pending-confirmation'`
- Hides Edit/Delete buttons for pending jobs
- Buttons trigger confirmation workflow

**`SchedulingPage.tsx`:**
- Added `handleConfirmJob()` - confirms booking
- Added `handleDeclineJob()` - shows decline reason modal
- Added decline modal with optional reason textarea

**`JobCard.tsx` & `Calendar.tsx`:**
- Added pending-confirmation status colors

**`JobForm.tsx`:**
- Added "Pending Confirmation" as status option

**`PublicBookingPage.tsx`:**
- Confirmation screen adapts message based on `requireConfirmation`
- Shows different icons (clock vs checkmark)
- Explains pending vs confirmed status clearly

### Job Store Methods

```typescript
confirmJob(id: string): Promise<void>
declineJob(id: string, reason?: string): Promise<void>
```

Both methods:
- Call backend API
- Update local job state
- Handle errors appropriately

## Configuration

### Service Settings

In the Service form, configure:

**Booking Settings → Require Confirmation**
- **Unchecked** (default): Bookings are instantly confirmed
- **Checked**: Bookings require manual approval

### Environment Variables (Infrastructure)

**Backend Lambda Environment:**
```bash
SES_ENABLED=false         # false in dev, true in staging/prod
SES_REGION=us-east-1      # AWS region for SES
SES_FROM_ADDRESS=noreply@jobdock.dev  # Sender email address
```

**CDK Config** (`infrastructure/config.ts`):
```typescript
{
  sesFromAddress: 'noreply@jobdock.dev'  // Configurable per environment
}
```

### AWS SES Setup (for staging/prod)

Before emails will send in staging/production:

1. **Verify sender email** in AWS SES:
   ```bash
   aws ses verify-email-identity --email-address noreply@jobdock.dev --region us-east-1
   ```

2. **Move out of SES Sandbox** (production):
   - Go to AWS Console → SES → Account Dashboard
   - Request production access
   - Once approved, you can send to any email address

3. **Optional: Verify domain** for better deliverability:
   - Use your own domain (e.g., `@yourcompany.com`)
   - Add DNS records as instructed by SES

## Testing

### Dev Mode (Console Logging)

Since `SES_ENABLED=false` in dev, emails are logged to CloudWatch:

1. **Create a test service** with `requireConfirmation` checked
2. **Book via public link**
3. **Check CloudWatch logs** for the Data Lambda:
   ```
   📧 =============== EMAIL (Dev Mode) ===============
   To: client@example.com
   From: noreply@jobdock.dev
   Subject: Booking request received - House Cleaning
   ---
   [Email content here]
   ================================================
   ```

4. **Go to Scheduling tab** and find the pending job (orange badge)
5. **Click on it** and use Confirm or Decline buttons
6. **Check CloudWatch logs** again for confirmation/decline emails

### Staging/Prod Mode (Real Emails)

With `SES_ENABLED=true` and a verified email:

1. **Use your verified email** as the client email when booking
2. **Check your inbox** for:
   - Booking confirmation or pending message
   - Follow-up confirmation if approved
3. **Contractor receives** notification at their logged-in user email
4. **Test full workflow**:
   - Book → Receive pending email
   - Contractor confirms → Receive confirmation email
   - Book another → Contractor declines → Receive decline email

## Email Examples

### Client - Instant Confirmation
```
Subject: Your booking is confirmed - House Cleaning

Hi John Doe,

Your booking has been confirmed! Here are the details:

Service: House Cleaning
Date: Friday, January 10, 2026
Time: 2:00 PM - 3:00 PM
Location: 123 Main St

We look forward to seeing you!
```

### Client - Pending Confirmation
```
Subject: Booking request received - House Cleaning

Hi John Doe,

We've received your booking request for:

Service: House Cleaning
Date: Friday, January 10, 2026  
Time: 2:00 PM

Your request is pending confirmation. We'll send you another email once it's confirmed.
```

### Contractor - New Booking
```
Subject: New booking request for House Cleaning

Hi Contractor,

You have a new booking request for House Cleaning.

Client: John Doe
Email: john@example.com
Phone: (555) 123-4567
Service: House Cleaning
Date: Friday, January 10, 2026
Time: 2:00 PM - 3:00 PM

⚠️ This booking requires your confirmation. Please log in to your dashboard to confirm or decline.

[View in Dashboard]
```

## Workflow Diagrams

### Instant Confirmation Flow

```
Client books → Job created (scheduled) → Emails sent:
                                          ├─ Client: "Booking confirmed"
                                          └─ Contractor: "New booking" (auto-confirmed)
```

### Require Confirmation Flow

```
Client books → Job created (pending) → Emails sent:
                                        ├─ Client: "Request received"
                                        └─ Contractor: "New request" (needs action)
             ↓
Contractor confirms → Status: scheduled → Email to client: "Booking confirmed"
             OR
Contractor declines → Status: cancelled → Email to client: "Booking declined"
```

## Troubleshooting

### Emails not sending in dev
- **Expected behavior** - Dev mode logs to console instead
- Check CloudWatch logs for the DataLambda function

### Emails not sending in staging/prod
- Verify `SES_ENABLED=true` in Lambda environment
- Verify sender email in SES console
- Check if still in SES Sandbox (can only send to verified emails)
- Check CloudWatch logs for SES errors

### Contractor not receiving emails
- Contractor email is pulled from logged-in user
- For public bookings (no auth), email may not be sent
- Consider adding a tenant-level contact email as fallback

### Wrong "from" address
- Update `sesFromAddress` in `infrastructure/config.ts`
- Redeploy the stack
- Verify the new address in SES

## Future Enhancements

Potential improvements:
- [ ] SMS notifications via SNS
- [ ] Reminder emails (24hr before appointment)
- [ ] Customizable email templates per tenant
- [ ] Email template editor in UI
- [ ] Cancellation emails (when jobs are cancelled)
- [ ] Rescheduling emails
- [ ] Calendar invite attachments (.ics files)
- [ ] Multi-language email support
- [ ] Email tracking and analytics

## Related Files

**Backend:**
- `backend/src/lib/email.ts` - Email utility and templates
- `backend/src/lib/dataService.ts` - booking/confirm/decline logic
- `backend/src/functions/data/handler.ts` - API routes

**Frontend:**
- `src/features/scheduling/types/job.ts` - Job status types
- `src/features/scheduling/store/jobStore.ts` - Confirm/decline actions
- `src/features/scheduling/components/JobDetail.tsx` - Confirmation UI
- `src/features/booking/pages/PublicBookingPage.tsx` - Client messaging

**Infrastructure:**
- `infrastructure/lib/jobdock-stack.ts` - SES permissions and env vars
- `infrastructure/config.ts` - SES configuration per environment

