# Test Execution Quick-Start Checklist

This is a condensed checklist to quickly verify the booking and scheduling system is production-ready.

## Pre-Flight Checks ✈️

### Environment Configuration
```bash
# 1. Verify frontend is in live mode
grep "VITE_USE_MOCK_DATA" .env
# Should show: VITE_USE_MOCK_DATA=false

# 2. Verify API URL is set
grep "VITE_API_URL" .env
# Should show your API Gateway URL, not localhost:8000

# 3. Check backend is deployed
aws lambda list-functions --query "Functions[?contains(FunctionName, 'DataLambda')].FunctionName"

# 4. Verify SES configuration
aws lambda get-function-configuration \
  --function-name $(aws lambda list-functions --query "Functions[?contains(FunctionName, 'DataLambda')].FunctionName" --output text) \
  --query 'Environment.Variables.{SES_ENABLED:SES_ENABLED,SES_FROM_ADDRESS:SES_FROM_ADDRESS,PUBLIC_APP_URL:PUBLIC_APP_URL}'
```

**Expected Results:**
- ✅ `VITE_USE_MOCK_DATA=false`
- ✅ `VITE_API_URL` points to AWS
- ✅ DataLambda function exists
- ✅ `SES_FROM_ADDRESS` is verified in SES
- ✅ `PUBLIC_APP_URL` matches your domain

## Critical Path Tests (30 minutes)

### Test 1: Public Booking → Pending Confirmation ⏱️ 5 min

**Steps:**
1. Create service requiring confirmation (if not exists)
2. Get booking link from Services tab
3. Open link in incognito window
4. Select tomorrow, pick a time slot
5. Fill form: Name="Test User", Email="your-test@email.com", Phone="555-1234"
6. Submit booking

**Verify:**
- [ ] Confirmation screen shows "Pending Confirmation"
- [ ] Job appears in Scheduling tab with orange badge
- [ ] Email received (or logged in CloudWatch if SES disabled)

### Test 2: Confirm Booking → Client Notified ⏱️ 3 min

**Steps:**
1. In Scheduling tab, click the pending job
2. Click "Confirm Booking" button
3. Check job status
4. Check email/logs

**Verify:**
- [ ] Status changes to "Scheduled" (blue badge)
- [ ] Confirm button disappears
- [ ] Client receives "confirmed" email

### Test 3: Double-Booking Prevention ⏱️ 5 min

**Steps:**
1. Note the time slot from Test 1
2. Open booking link in new incognito window
3. Try to book the same slot

**Verify:**
- [ ] The time slot is NOT available
- [ ] No slots show for that exact time

### Test 4: Decline Booking → Slot Available ⏱️ 5 min

**Steps:**
1. Create another pending booking
2. Click job, then "Decline"
3. Enter reason: "Test decline"
4. Confirm decline
5. Check public booking page

**Verify:**
- [ ] Status changes to "Cancelled" (red badge)
- [ ] Slot becomes available again on public page
- [ ] Client receives decline email with reason

### Test 5: Instant Confirmation ⏱️ 4 min

**Steps:**
1. Create/find service with `requireConfirmation=false`
2. Complete public booking for this service

**Verify:**
- [ ] Confirmation screen shows "Booking Confirmed!" (not pending)
- [ ] Job immediately has "Scheduled" status (blue)
- [ ] Confirmation email sent immediately

### Test 6: Working Hours Enforcement ⏱️ 3 min

**Steps:**
1. View service with working hours 9 AM - 5 PM
2. Check available time slots

**Verify:**
- [ ] No slots before 9 AM
- [ ] No slots ending after 5 PM
- [ ] Weekends show no slots (if not configured)

### Test 7: Admin Conflict Detection ⏱️ 3 min

**Steps:**
1. Manually create job: Tomorrow 2:00 PM - 3:00 PM
2. Try to create overlapping job: Tomorrow 2:30 PM - 3:30 PM

**Verify:**
- [ ] Error message appears
- [ ] Error mentions conflicting job details
- [ ] Second job NOT created

### Test 8: Email Link Verification ⏱️ 2 min

**Steps:**
1. Check contractor notification email
2. Click "View in Dashboard" link

**Verify:**
- [ ] Link uses correct domain (not localhost)
- [ ] Link opens to Scheduling page
- [ ] User can see the booking

## Quick Database Verification

```bash
# Connect to database (via bastion/tunnel)
# Check recent bookings
SELECT id, title, status, "startTime", "endTime", "createdAt"
FROM jobs
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
ORDER BY "createdAt" DESC
LIMIT 10;

# Check for any double-bookings (should return 0 rows)
WITH overlapping AS (
  SELECT j1.id, j1.title, j1."startTime", j1."endTime",
         j2.id as conflict_id, j2.title as conflict_title
  FROM jobs j1
  JOIN jobs j2 ON j1."tenantId" = j2."tenantId"
    AND j1.id < j2.id
    AND j1."startTime" < j2."endTime"
    AND j1."endTime" > j2."startTime"
    AND j1.status IN ('scheduled', 'in-progress', 'pending-confirmation')
    AND j2.status IN ('scheduled', 'in-progress', 'pending-confirmation')
)
SELECT * FROM overlapping;

# Should return 0 rows - no overlaps!
```

## CloudWatch Logs Verification

```bash
# Tail logs during testing
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda --follow --format short

# Look for these patterns:
# ✅ "Booking request received"
# ✅ "Email sent via SES" OR "EMAIL (Dev Mode)"
# ✅ "Job created" / "Job updated"
# ❌ Any ERROR or exception stack traces
```

## Performance Check

```bash
# Check API response times
curl -w "\n\nTime: %{time_total}s\n" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: demo-tenant" \
  "https://YOUR_API_URL/services"

# Should be < 500ms for good UX
```

## Edge Cases Quick Test (10 minutes)

### EC1: Same-Day Booking (if disabled)
- [ ] Today's date shows no slots

### EC2: Advance Booking Limit
- [ ] Navigate to 31+ days in future
- [ ] Verify no slots available

### EC3: Service with No Working Hours
- [ ] All days disabled
- [ ] "No available times" message shows

### EC4: Past Date Booking Attempt
- [ ] Past dates disabled in calendar
- [ ] Past times today are hidden

### EC5: Invalid Email in Booking Form
- [ ] Enter "notanemail"
- [ ] Submit button disabled or error shown

## Browser Compatibility (5 minutes)

Test basic flow in:
- [ ] Chrome (your main browser)
- [ ] Firefox OR Safari
- [ ] Mobile browser (any)

**Each should:**
- Display calendar correctly
- Allow booking submission
- Show confirmation screen

## Status Lifecycle Verification

Check that all status badges display correctly:

| Status | Color | Where to See |
|--------|-------|--------------|
| Pending Confirmation | Orange | Job created via booking form (requires confirmation) |
| Scheduled | Blue | Confirmed job or instant booking |
| In Progress | Yellow | Manually set in admin |
| Completed | Green | Manually set in admin |
| Cancelled | Red | Declined booking or manually cancelled |

**Test:**
1. View each status in calendar month view
2. View in calendar day/week view
3. View in upcoming jobs list
4. View in job detail modal

All should show correct color and label.

## Rollback Plan

If critical issues found:

1. **Revert to Mocks Immediately:**
   ```bash
   # In .env
   VITE_USE_MOCK_DATA=true
   
   # Restart dev server
   npm run dev
   ```

2. **Document the Issue:**
   - What test failed
   - What was expected vs actual
   - Steps to reproduce
   - Any error messages

3. **Fix in Dev Environment:**
   - Make code changes
   - Test thoroughly
   - Redeploy when ready

## Success Criteria

**PASS** if ALL of the following:
- ✅ All 8 Critical Path Tests pass
- ✅ No double-bookings found in database
- ✅ No errors in CloudWatch logs (except expected validation errors)
- ✅ Emails sending correctly (or logging correctly if SES disabled)
- ✅ All status badges display correctly
- ✅ At least 2 browsers work correctly

**CONDITIONAL PASS** if:
- Minor UI glitches (can be fixed post-launch)
- Email deliverability issues (if SES still in sandbox)
- Performance slightly slow but acceptable (< 1 second)

**FAIL** if ANY of the following:
- ❌ Double-booking possible
- ❌ Booking fails with 500 error
- ❌ Data not persisting
- ❌ Security issue (unauthorized access, XSS, etc.)
- ❌ Critical UX issue (booking form unusable)

## Post-Test Report Template

```
# Booking System Test Report

**Date:** [Date]
**Tester:** [Name]
**Environment:** [dev/staging/prod]
**Duration:** [Total time spent]

## Results Summary
- Critical Path Tests: [X/8] passed
- Edge Cases: [X/5] passed
- Browser Compatibility: [X/3] passed
- Overall: [PASS/CONDITIONAL PASS/FAIL]

## Issues Found
1. [Title] - [Severity: Critical/Major/Minor]
   - Description: ...
   - Steps to reproduce: ...
   - Status: [Open/Fixed/Won't Fix]

## Performance Metrics
- API response time: [X]ms (target: <500ms)
- Email delivery rate: [X]% (target: >95%)
- Database queries: [X]ms average

## Recommendations
- [Action item 1]
- [Action item 2]
- ...

## Sign-off
- [ ] System ready for beta users
- [ ] System ready for production
- [ ] Additional testing required

**Tester Signature:** _______________
**Date:** _______________
```

## Next Steps After Testing

### If All Tests Pass:
1. ✅ Mark system as production-ready
2. ✅ Create customer-facing documentation
3. ✅ Brief support team
4. ✅ Begin gradual rollout (see BOOKING_E2E_TEST_GUIDE.md)
5. ✅ Set up monitoring alerts
6. ✅ Schedule post-launch check-in (1 week)

### If Issues Found:
1. Categorize by severity (critical/major/minor)
2. Fix critical issues immediately
3. Schedule major issues for next sprint
4. Document minor issues as technical debt
5. Retest after fixes
6. Update this checklist with lessons learned

---

**Quick Start Command:**
```bash
# Run all checks in one go (copy-paste friendly)
echo "=== Environment Check ===" && \
grep "VITE_USE_MOCK_DATA\|VITE_API_URL" .env && \
echo "\n=== Lambda Check ===" && \
aws lambda list-functions --query "Functions[?contains(FunctionName, 'DataLambda')].FunctionName" && \
echo "\n=== Ready for manual testing! ===" && \
echo "Open app and follow Critical Path Tests above"
```

**Time Estimate:** 
- Pre-flight checks: 5 minutes
- Critical path tests: 30 minutes
- Edge cases: 10 minutes
- Browser testing: 5 minutes
- **Total: ~50 minutes for thorough testing**

Good luck! 🚀

