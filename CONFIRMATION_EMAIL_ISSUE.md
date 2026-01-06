# Confirmation Email Issue - Troubleshooting

## Issue
When confirming a booking in the dashboard, the client should receive a "Your booking has been confirmed" email, but it's not arriving.

## Expected Behavior

### When Booking is Confirmed:
```
Contractor clicks "Confirm" → Job status changes to 'scheduled' → Email sent to client
```

**Email should contain:**
- Subject: "Your booking has been confirmed - [Service Name]"
- From: jordan@westwavecreative.com
- To: [Client email]
- Content: Booking details with date, time, location

## Current Setup

✅ **SES Enabled:** `true`  
✅ **Sender Verified:** `jordan@westwavecreative.com`  
✅ **Code in Place:** `dataService.ts` lines 541-557

## Troubleshooting Steps

### 1. Check Spam/Junk Folder
- **Most common issue!**
- Emails from newly verified senders often go to spam initially
- Check spam folder for emails from `jordan@westwavecreative.com`

### 2. Verify Booking Was Pending
The confirmation email only sends if:
- Job status was `'pending-confirmation'` before confirming
- If job was already `'scheduled'`, no email is sent

**To check:**
- Look at the booking before confirming
- Should show orange "Pending Confirmation" badge
- If it was already green/scheduled, that's why no email sent

### 3. Check CloudWatch Logs

**Via AWS Console:**
1. Go to: https://console.aws.amazon.com/cloudwatch/
2. Navigate to: Logs → Log groups
3. Find: `/aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc`
4. Check recent log streams for:
   - `✅ Email sent via SES to [email]` (success)
   - `❌ Failed to send email` (error)
   - `Failed to send confirmation email:` (caught error)

### 4. Test with Different Email

To rule out same-sender-recipient issues:

**A. Verify a different email:**
```bash
aws ses verify-email-identity --email-address DIFFERENT_EMAIL@gmail.com --region us-east-1
```

**B. Create a new booking with that different email**

**C. Confirm the booking**

**D. Check that email inbox**

### 5. Known Issue: setImmediate with Lambda

The email is sent using `setImmediate()` which might not execute properly in Lambda if the function returns before the async operation completes.

**Potential fix:** Change from `setImmediate` to `await` (but this would slow down the API response)

## Quick Test

### Test Confirmation Email Right Now:

1. **Create a new booking** (use incognito window):
   - Go to public booking page
   - Use `jordan@westwavecreative.com` as client email
   - Make sure service has "Require Confirmation" enabled
   - Submit booking

2. **You should receive:**
   - "Booking request received" email immediately

3. **Confirm the booking** in dashboard

4. **Check inbox AND spam folder** for:
   - "Your booking has been confirmed" email

5. **If still no email, check AWS Console CloudWatch logs**

## Possible Solutions

### Solution 1: Check Spam
- Most likely cause
- Add `jordan@westwavecreative.com` to contacts
- Mark as "Not Spam" if found there

### Solution 2: Fix setImmediate Issue

If emails are failing silently due to Lambda timing:

**Change in `backend/src/lib/dataService.ts` (line 542):**

```typescript
// Current (async, non-blocking):
setImmediate(async () => {
  try {
    if (job.contact.email) {
      // send email
    }
  } catch (emailError) {
    console.error('Failed to send confirmation email:', emailError)
  }
})

// Alternative (blocking, but guaranteed):
try {
  if (job.contact.email) {
    const emailPayload = buildClientBookingConfirmedEmail({...})
    await sendEmail({ ...emailPayload, to: job.contact.email })
  }
} catch (emailError) {
  console.error('Failed to send confirmation email:', emailError)
}
```

**Trade-off:**
- ✅ Guarantees email is sent before Lambda exits
- ❌ API response is slower (waits for email to send)

### Solution 3: Add More Logging

Add console.log before and after email send to track execution:

```typescript
setImmediate(async () => {
  console.log('🔔 Attempting to send confirmation email...')
  try {
    if (job.contact.email) {
      console.log(`📧 Sending to: ${job.contact.email}`)
      const emailPayload = buildClientBookingConfirmedEmail({...})
      await sendEmail({ ...emailPayload, to: job.contact.email })
      console.log('✅ Confirmation email sent successfully')
    } else {
      console.log('⚠️ No client email found')
    }
  } catch (emailError) {
    console.error('❌ Failed to send confirmation email:', emailError)
  }
})
```

## Next Steps

1. **Check spam folder** (most likely)
2. **Test with different email** (rule out same-sender issue)
3. **Check CloudWatch logs** (see if email was attempted)
4. **If needed:** Implement Solution 2 or 3 above

## Status Check Commands

**Check SES configuration:**
```bash
aws lambda get-function-configuration --function-name JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --query 'Environment.Variables.{SES_ENABLED:SES_ENABLED,SES_FROM:SES_FROM_ADDRESS}' --output table
```

**Check verified emails:**
```bash
aws ses list-identities --region us-east-1
```

**Check recent Lambda invocations:**
```bash
aws logs describe-log-streams --log-group-name /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --order-by LastEventTime --descending --max-items 5
```

---

**Most Likely Cause:** Email went to spam folder. Check there first! 📧

