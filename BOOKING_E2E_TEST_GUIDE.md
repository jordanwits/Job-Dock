# End-to-End Booking & Scheduling Test Guide

This guide provides a comprehensive test plan for production-ready booking and scheduling features.

## Prerequisites

Before testing:
- [ ] Live AWS stack deployed (dev or prod)
- [ ] `VITE_USE_MOCK_DATA=false` in frontend `.env`
- [ ] Database migrations applied
- [ ] At least one test service created with working hours
- [ ] At least one test user authenticated

## Test Environment Setup

1. **Create Test Service**
   - Name: "Test Consultation"
   - Duration: 60 minutes
   - Working hours: Mon-Fri, 9:00 AM - 5:00 PM
   - Buffer time: 15 minutes
   - Advance booking: 30 days
   - Same-day booking: disabled
   - Max bookings per slot: 1
   - Require confirmation: **true** (for testing confirmation flow)

2. **Create Test Service #2 (Instant Confirmation)**
   - Name: "Quick Service"
   - Duration: 30 minutes
   - Working hours: Mon-Fri, 9:00 AM - 5:00 PM
   - Require confirmation: **false** (for testing instant booking)

## Test Suite 1: Public Booking Flow

### 1.1 Service Selection
```
GIVEN: Public booking page at /book
WHEN: User visits the page
THEN: 
  ✓ All active services are displayed
  ✓ Services show name, duration, and price
  ✓ Inactive services are not displayed
```

**Test Steps:**
1. Open `/book` in incognito window
2. Verify test services appear
3. Deactivate one service in admin panel
4. Refresh public booking page
5. Verify deactivated service is hidden

### 1.2 Availability Calendar

```
GIVEN: Service selected
WHEN: User views calendar
THEN:
  ✓ Days with available slots show indicator dots
  ✓ Past dates are disabled
  ✓ Days outside working hours have no slots
  ✓ Days beyond advance booking window have no slots
```

**Test Steps:**
1. Select "Test Consultation"
2. Check current month calendar
3. Verify:
   - Today (if past business hours) has no slots
   - Tomorrow has slots (if working day)
   - Weekends have no slots (per configuration)
   - Days 31+ in future have no slots
4. Navigate to next month
5. Verify slots appear for working days

### 1.3 Time Slot Selection

```
GIVEN: Date selected with available slots
WHEN: User views time slots
THEN:
  ✓ Slots are spaced by service duration + buffer time
  ✓ Slots within working hours only
  ✓ Slots with existing bookings are hidden
  ✓ Past time slots today are hidden
```

**Test Steps:**
1. Select tomorrow's date
2. Verify slots show every 75 minutes (60min service + 15min buffer)
3. Verify first slot is at 9:00 AM
4. Verify last slot allows completion by 5:00 PM
5. Select a slot and complete booking
6. In new incognito window, verify that slot is now hidden

### 1.4 Booking Form

```
GIVEN: Time slot selected
WHEN: User fills booking form
THEN:
  ✓ Required fields validated (name, email, phone)
  ✓ Email format validated
  ✓ Form cannot submit with invalid data
  ✓ Loading state shown during submission
```

**Test Steps:**
1. Select a time slot
2. Try submitting empty form - should fail
3. Enter invalid email - should fail
4. Enter valid data:
   - Name: "Test Client"
   - Email: "test@example.com"
   - Phone: "(555) 123-4567"
5. Submit successfully

### 1.5 Booking Confirmation (Requires Confirmation)

```
GIVEN: Booking submitted for service requiring confirmation
WHEN: Booking completes
THEN:
  ✓ Success screen shows "Pending Confirmation" message
  ✓ Booking details displayed (service, date, time, client)
  ✓ Email sent explaining pending status
  ✓ Job appears in admin calendar with "pending-confirmation" status
```

**Test Steps:**
1. Complete booking for "Test Consultation"
2. Verify confirmation screen shows pending message
3. Check email inbox (if SES enabled) for pending notification
4. Log in to admin panel
5. Navigate to Scheduling tab
6. Verify job appears with orange "Pending Confirmation" badge

### 1.6 Booking Confirmation (Instant Confirmation)

```
GIVEN: Booking submitted for service NOT requiring confirmation
WHEN: Booking completes
THEN:
  ✓ Success screen shows "Confirmed" message
  ✓ Email sent with confirmed status
  ✓ Job appears in admin calendar with "scheduled" status
```

**Test Steps:**
1. Complete booking for "Quick Service"
2. Verify confirmation screen shows "Confirmed!" message
3. Check email for instant confirmation
4. Verify job in admin calendar has "Scheduled" status (blue)

## Test Suite 2: Double-Booking Prevention

### 2.1 Concurrent Booking Attempts

```
GIVEN: Same time slot available
WHEN: Two users try to book simultaneously
THEN:
  ✓ First booking succeeds
  ✓ Second booking fails with "slot no longer available"
  ✓ Slot disappears from both users' availability views
```

**Test Steps:**
1. Open two incognito windows side by side
2. Navigate both to `/book`
3. Select same service in both
4. Select same date in both
5. Select same time slot in both
6. Fill forms in both
7. Click submit in both quickly (within 1 second)
8. Verify:
   - One shows success
   - Other shows error about unavailable slot
9. Refresh first window
10. Verify slot is gone

### 2.2 Pending Bookings Count Toward Capacity

```
GIVEN: Service with pending-confirmation booking
WHEN: Another user tries to book same slot
THEN:
  ✓ Slot is not shown as available
  ✓ Pending bookings block new bookings
```

**Test Steps:**
1. Create booking requiring confirmation (creates pending job)
2. In new incognito window, navigate to same service
3. Verify the booked slot does not appear as available
4. In admin, confirm the pending job
5. Refresh public booking page
6. Verify slot still not available (now scheduled)

### 2.3 Confirmed Booking Blocks Slot

```
GIVEN: Slot with confirmed (scheduled) job
WHEN: Public user views availability
THEN:
  ✓ Slot is not shown
  ✓ Adjacent slots with proper buffer are shown
```

**Test Steps:**
1. Confirm a pending booking in admin
2. Public booking page should not show that slot
3. Verify slots before and after (with buffer) are available

## Test Suite 3: Business Rules Enforcement

### 3.1 Working Hours Enforcement

```
GIVEN: Service with specific working hours
WHEN: Attempting to book outside hours
THEN:
  ✓ Slots outside hours are not generated
  ✓ Attempting to force-book fails with error
```

**Test Steps:**
1. View service with 9 AM - 5 PM hours
2. Verify no slots before 9 AM or after 5 PM
3. Verify job ending at/after 5 PM not available

### 3.2 Same-Day Booking Policy

```
GIVEN: Service with same-day booking disabled
WHEN: Today's date selected
THEN:
  ✓ No slots shown for today
  ✓ Tomorrow shows slots
```

**Test Steps:**
1. View service with same-day disabled
2. Verify today shows "No available times"
3. Verify tomorrow shows times
4. Edit service to enable same-day
5. Refresh booking page
6. Verify today now shows available times (if still business hours)

### 3.3 Advance Booking Window

```
GIVEN: Service with 30-day advance booking limit
WHEN: Viewing dates beyond window
THEN:
  ✓ Dates 31+ days away have no slots
  ✓ Days within window show slots
```

**Test Steps:**
1. Navigate calendar to 2+ months ahead
2. Verify no slots available
3. Navigate to dates within 30 days
4. Verify slots available

### 3.4 Past Date Blocking

```
GIVEN: Current date/time
WHEN: User views availability
THEN:
  ✓ Past dates completely disabled
  ✓ Past time slots today are hidden
  ✓ Future slots today shown (if same-day enabled)
```

**Test Steps:**
1. Navigate to previous month
2. Try selecting date - should be disabled
3. View today - past hour slots should be hidden

## Test Suite 4: Admin Scheduling Conflict Detection

### 4.1 Manual Job Creation Conflict

```
GIVEN: Existing scheduled job
WHEN: Admin tries to create overlapping job
THEN:
  ✓ Error shown with conflict details
  ✓ Job not created
  ✓ Existing job unaffected
```

**Test Steps:**
1. Create job: Tomorrow 2:00 PM - 3:00 PM
2. Try to create: Tomorrow 2:30 PM - 3:30 PM
3. Verify error: "conflicts with existing job"
4. Verify only first job exists

### 4.2 Adjacent Jobs (No Conflict)

```
GIVEN: Job ending at 3:00 PM
WHEN: Creating job starting at 3:00 PM
THEN:
  ✓ Job created successfully (no overlap)
  ✓ Both jobs visible in calendar
```

**Test Steps:**
1. Create job: Tomorrow 2:00 PM - 3:00 PM
2. Create job: Tomorrow 3:00 PM - 4:00 PM
3. Verify both appear in calendar without error

## Test Suite 5: Job Status Lifecycle

### 5.1 Pending → Confirmed Flow

```
GIVEN: Job in pending-confirmation status
WHEN: Admin confirms job
THEN:
  ✓ Status changes to "scheduled"
  ✓ Color changes from orange to blue
  ✓ Client receives confirmation email
  ✓ Confirm button no longer shown
```

**Test Steps:**
1. Create pending booking via public form
2. In Scheduling tab, click job
3. Verify "Pending Confirmation" badge (orange)
4. Click "Confirm Booking"
5. Verify status changes to "Scheduled" (blue)
6. Check email sent to client
7. Reopen job - confirm button gone

### 5.2 Pending → Declined Flow

```
GIVEN: Job in pending-confirmation status
WHEN: Admin declines job
THEN:
  ✓ Status changes to "cancelled"
  ✓ Client receives decline email with reason
  ✓ Slot becomes available again
```

**Test Steps:**
1. Create pending booking
2. Click job in Scheduling tab
3. Click "Decline"
4. Enter reason: "Not available at this time"
5. Confirm decline
6. Verify status → "Cancelled" (red)
7. Check client email includes reason
8. Verify slot available again in public booking

### 5.3 Cannot Confirm Non-Pending Job

```
GIVEN: Job already in "scheduled" status
WHEN: Viewing job details
THEN:
  ✓ Confirm/Decline buttons not shown
  ✓ Edit/Delete buttons shown instead
```

**Test Steps:**
1. Create instant-confirmation booking
2. View job (already "scheduled")
3. Verify no confirm/decline buttons
4. Verify edit and delete are available

## Test Suite 6: Email Notifications

### 6.1 Client Emails (SES Enabled)

**Pending Confirmation Email:**
- [ ] Subject: "Booking request received"
- [ ] Contains service name
- [ ] Contains date and time
- [ ] Explains pending confirmation
- [ ] HTML renders correctly

**Instant Confirmation Email:**
- [ ] Subject: "Your booking is confirmed"
- [ ] Contains all booking details
- [ ] Contains location (if provided)
- [ ] No mention of "pending"
- [ ] HTML renders correctly

**Confirmed Email (After Pending):**
- [ ] Subject: "Your booking has been confirmed"
- [ ] Contains updated details
- [ ] Clear "confirmed" message
- [ ] HTML renders correctly

**Declined Email:**
- [ ] Subject: "Booking request declined"
- [ ] Contains reason (if provided)
- [ ] Apologetic tone
- [ ] Suggests rebooking
- [ ] HTML renders correctly

### 6.2 Contractor Emails

**New Booking Notification:**
- [ ] Subject includes service name
- [ ] Contains client contact info (name, email, phone)
- [ ] Shows booking date/time
- [ ] "View in Dashboard" link works
- [ ] Link points to correct domain (PUBLIC_APP_URL)
- [ ] Indicates if confirmation required

**Test Steps for All Emails:**
1. Enable SES (`SES_ENABLED=true`)
2. Perform each booking/action type
3. Check inbox for emails
4. Verify not in spam
5. Test all links in emails
6. Check HTML rendering in multiple clients

## Test Suite 7: Edge Cases

### 7.1 Service with No Working Hours

```
GIVEN: Service with all days disabled
WHEN: User views availability
THEN:
  ✓ No slots shown for any date
  ✓ Message: "No available times"
```

### 7.2 Booking at Edge of Working Hours

```
GIVEN: Service ends at 5:00 PM, 60-min duration
WHEN: Viewing slots for 4:00 PM - 5:00 PM
THEN:
  ✓ Slot is NOT available (would end at 5:00 PM exactly or after)
  ✓ Latest slot allows completion before 5:00 PM
```

### 7.3 Service Duration Longer Than Working Hours

```
GIVEN: 8-hour duration, 6-hour working day
WHEN: Viewing availability
THEN:
  ✓ No slots available (impossible to fit)
```

### 7.4 Multiple Overlapping Existing Jobs

```
GIVEN: Multiple jobs already scheduled
WHEN: Calculating availability
THEN:
  ✓ All conflicting slots hidden
  ✓ Only genuinely free slots shown
```

### 7.5 Booking Form Validation

- [ ] Email validation (invalid formats rejected)
- [ ] Phone validation (optional field)
- [ ] Name required
- [ ] Special characters handled correctly
- [ ] XSS attempts sanitized

### 7.6 Network Failures

- [ ] Booking submission failure shows error
- [ ] User can retry booking
- [ ] No duplicate bookings on retry
- [ ] Loading states prevent double-submit

## Test Suite 8: Performance & Load

### 8.1 Concurrent Users

```
Test with 10+ concurrent users:
- [ ] All see accurate availability
- [ ] No race conditions
- [ ] Database transactions atomic
- [ ] API response time < 500ms
```

### 8.2 Large Date Ranges

```
GIVEN: Requesting 60 days of availability
WHEN: API calculates slots
THEN:
  ✓ Response time < 1 second
  ✓ All slots correctly calculated
```

### 8.3 Many Existing Jobs

```
GIVEN: 100+ existing jobs in calendar
WHEN: Calculating availability
THEN:
  ✓ Conflicts properly detected
  ✓ Performance remains acceptable
```

## Test Suite 9: Mobile Responsiveness

- [ ] Calendar displays correctly on mobile
- [ ] Time slot selection works on touch
- [ ] Booking form usable on small screens
- [ ] All buttons accessible
- [ ] No horizontal scrolling

## Test Suite 10: Cross-Browser Testing

Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

## Monitoring & Observability

During testing, monitor:

### CloudWatch Logs
```bash
aws logs tail /aws/lambda/JobDockStack-[env]-DataLambda --follow
```

Look for:
- Booking attempts
- Email send confirmations/errors
- Database query performance
- Error stack traces

### CloudWatch Metrics

- Lambda invocation count
- Lambda error rate
- API Gateway 4xx/5xx rates
- Lambda duration (p50, p95, p99)

### Database

- Connection pool usage
- Query execution time
- Transaction conflicts/retries

## Issue Tracking Template

When bugs found, document:

```
**Test Case:** [Suite number].[Test number]
**Expected:** [What should happen]
**Actual:** [What actually happened]
**Reproduction Steps:**
1. Step one
2. Step two
3. ...

**Environment:**
- Stack: dev/prod
- Browser: Chrome 120
- User type: public/admin

**Logs:** [CloudWatch log snippet]
**Screenshots:** [Attach if visual issue]
```

## Success Criteria

All test suites must pass with:
- ✅ 0 critical bugs (booking fails, data loss, security issues)
- ✅ < 5 minor bugs (cosmetic, edge cases)
- ✅ Email delivery rate > 95%
- ✅ API response time p95 < 500ms
- ✅ Zero double-bookings observed
- ✅ All status transitions correct
- ✅ Mobile experience acceptable

## Post-Testing Actions

After successful testing:

1. Document any configuration changes needed
2. Update troubleshooting guides with new insights
3. Create runbook for common issues
4. Brief team on booking flow
5. Set up monitoring alerts
6. Plan gradual rollout strategy

## Gradual Rollout Recommendation

1. **Week 1:** Internal team only (dogfooding)
2. **Week 2:** 5-10 beta customers with support available
3. **Week 3:** 25-50 customers, monitor closely
4. **Week 4:** Full rollout if metrics healthy

Monitor key metrics during each phase before expanding.

---

**Ready for Production Checklist:**

Before going live, ensure:
- [ ] All test suites completed
- [ ] Critical bugs resolved
- [ ] Email notifications working
- [ ] Double-booking prevention verified
- [ ] Monitoring and alerts configured
- [ ] Support team trained
- [ ] Rollback plan documented
- [ ] Customer communication prepared

