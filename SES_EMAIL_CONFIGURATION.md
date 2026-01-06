# SES Email Configuration for Production Booking

This guide ensures booking confirmation and notification emails work correctly in production.

## Overview

JobDock uses AWS SES (Simple Email Service) to send booking-related emails:
- **Client confirmation emails** (instant booking or pending confirmation)
- **Contractor notification emails** (new booking alerts)
- **Job confirmed/declined emails** (after manual confirmation)

## Email Flow Architecture

```
Public Booking → bookSlot → Job Created → setImmediate → sendEmail → SES
                                        ↓
                                   CloudWatch Logs (dev mode)
                                        OR
                                   Actual Email (prod mode)

Confirm/Decline → confirm/decline → Job Updated → setImmediate → sendEmail → SES
```

## SES Setup Requirements

### 1. Verify SES Identity

You need a verified email address or domain in AWS SES:

**Option A: Verify Email Address (Quick Start)**
```bash
aws ses verify-email-identity \
  --email-address noreply@jobdock.dev \
  --region us-east-1
```
Then check the verification email and click the link.

**Option B: Verify Domain (Production Recommended)**
```bash
aws ses verify-domain-identity \
  --domain jobdock.dev \
  --region us-east-1
```
Add the returned TXT record to your DNS, then:
```bash
# Enable DKIM for better deliverability
aws ses set-identity-dkim-enabled \
  --identity jobdock.dev \
  --dkim-enabled \
  --region us-east-1
```

### 2. Move Out of SES Sandbox (Required for Production)

By default, SES is in sandbox mode (can only send to verified addresses).

**Request Production Access:**
1. Go to AWS Console → SES → Account dashboard
2. Click "Request production access"
3. Provide:
   - Use case: "Booking confirmation emails for contractor management platform"
   - Website URL: Your domain
   - Email sending details
4. Usually approved within 24 hours

**Or via AWS Support:**
```bash
# Create support case requesting SES production access
aws support create-case \
  --subject "SES Production Access Request" \
  --service-code "service-ses" \
  --category-code "other" \
  --severity-code "normal" \
  --communication-body "Requesting production access for booking confirmations..."
```

### 3. Configure Infrastructure

In `infrastructure/config.ts`, set the SES sender for each environment:

```typescript
dev: {
  env: 'dev',
  sesFromAddress: 'noreply@jobdock.dev',  // Must be verified
  // ... other config
},

prod: {
  env: 'prod',
  sesFromAddress: 'noreply@yourdomain.com',  // Your verified domain
  // ... other config
}
```

### 4. Deploy with Email Enabled

The CDK stack automatically configures SES:

```typescript
// In infrastructure/lib/jobdock-stack.ts (lines 390-392)
SES_ENABLED: config.env !== 'dev' ? 'true' : 'false',
SES_REGION: this.region,
SES_FROM_ADDRESS: config.sesFromAddress || 'noreply@jobdock.dev',
```

**For dev environment** (emails log to CloudWatch):
```bash
cd infrastructure
npm run deploy:dev
```

**For production** (emails actually send):
```bash
cd infrastructure
npm run deploy:prod
```

## Email Templates Overview

All templates in `backend/src/lib/email.ts`:

### Client Emails

1. **Instant Confirmation** (`buildClientConfirmationEmail`)
   - Sent when `requireConfirmation = false`
   - Includes: service, date, time, location
   
2. **Pending Confirmation** (`buildClientPendingEmail`)
   - Sent when `requireConfirmation = true`
   - Explains booking awaits approval
   
3. **Booking Confirmed** (`buildClientBookingConfirmedEmail`)
   - Sent after contractor confirms
   - Includes all booking details
   
4. **Booking Declined** (`buildClientBookingDeclinedEmail`)
   - Sent when contractor declines
   - Includes optional reason

### Contractor Emails

5. **New Booking Notification** (`buildContractorNotificationEmail`)
   - Sent on every public booking
   - Includes client contact info
   - Links to dashboard for confirmation
   - Shows if action required (pending)

## Verifying Email Configuration

### Test in Dev Mode (CloudWatch Logs)

1. With `SES_ENABLED=false`, create a booking
2. Check Lambda logs:
```bash
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda --follow
```
3. Look for:
```
📧 =============== EMAIL (Dev Mode) ===============
To: client@example.com
From: noreply@jobdock.dev
Subject: Your booking is confirmed - Consultation
---
Hi John Doe,
Your booking has been confirmed! Here are the details:
...
```

### Test in Production Mode (Actual Emails)

1. Deploy with `SES_ENABLED=true`
2. Ensure recipient email is verified (if still in sandbox)
3. Create a test booking with your own email
4. Check inbox for confirmation email
5. Verify:
   - ✅ Email arrives (check spam folder)
   - ✅ Subject line correct
   - ✅ All booking details present
   - ✅ Links work (dashboard link in contractor email)
   - ✅ HTML renders properly

## Email Content Verification

### Critical Fields to Check

In `backend/src/lib/dataService.ts`, verify email callers pass actual addresses:

**bookSlot (lines 862-908):**
```typescript
// Client email
if (clientEmail) {
  const emailPayload = requireConfirmation 
    ? buildClientPendingEmail({ ... })
    : buildClientConfirmationEmail({ ... })
  await sendEmail({ ...emailPayload, to: clientEmail })  // ✓ Uses actual email
}

// Contractor email
if (contractorEmail) {
  const emailPayload = buildContractorNotificationEmail({ ... })
  await sendEmail({ ...emailPayload, to: contractorEmail })  // ✓ Uses actual email
}
```

**confirm/decline (lines 517-532, 557-571):**
```typescript
if (job.contact.email) {
  const emailPayload = buildClientBookingConfirmedEmail({ ... })
  await sendEmail({ ...emailPayload, to: job.contact.email })  // ✓ Uses actual email
}
```

### PUBLIC_APP_URL in Emails

Contractor notification emails include a "View in Dashboard" link using `PUBLIC_APP_URL`.

**Current value per environment:**
- **Dev**: `http://localhost:5173` (development only)
- **Prod**: `https://{config.domain}` (your actual domain)

**To verify:**
```bash
# Check deployed Lambda environment
aws lambda get-function-configuration \
  --function-name JobDockStack-prod-DataLambda \
  --query 'Environment.Variables.PUBLIC_APP_URL' \
  --output text
```

Should return your production domain, e.g., `https://app.jobdock.com`

## Troubleshooting

### Emails Not Sending

**Check 1: SES Identity Verified**
```bash
aws ses get-identity-verification-attributes \
  --identities noreply@jobdock.dev \
  --region us-east-1
```
Should show `"VerificationStatus": "Success"`

**Check 2: SES Enabled in Lambda**
```bash
aws lambda get-function-configuration \
  --function-name JobDockStack-prod-DataLambda \
  --query 'Environment.Variables.SES_ENABLED'
```
Should return `"true"` for production.

**Check 3: IAM Permissions**
Lambda execution role needs SES permissions (already in CDK stack lines 276-283):
```typescript
lambdaRole.addToPolicy(new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: ['ses:SendEmail', 'ses:SendRawEmail'],
  resources: ['*'],
}))
```

**Check 4: CloudWatch Logs**
```bash
aws logs tail /aws/lambda/JobDockStack-prod-DataLambda --follow
```
Look for:
- `✅ Email sent via SES to ...` (success)
- `❌ Failed to send email via SES: ...` (error)

### Emails Going to Spam

1. **Use verified domain** (not just email)
2. **Enable DKIM** for domain authentication
3. **Add SPF record** to DNS:
   ```
   v=spf1 include:amazonses.com ~all
   ```
4. **Set up DMARC** (optional but recommended):
   ```
   v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
   ```
5. **Monitor bounce rate** (keep below 5%)

### Wrong Links in Emails

If dashboard links point to localhost:

1. Check `PUBLIC_APP_URL` in Lambda environment
2. Update `infrastructure/config.ts`:
   ```typescript
   prod: {
     domain: 'app.yourdomain.com',  // Set this
   }
   ```
3. Redeploy: `npm run deploy:prod`

### SES Still in Sandbox

Symptoms:
- Can only email verified addresses
- Error: "Email address is not verified"

Solution:
- Request production access (see step 2 above)
- Meanwhile, verify test recipient emails:
  ```bash
  aws ses verify-email-identity --email-address test@example.com
  ```

## Monitoring Email Health

### CloudWatch Metrics to Watch

```bash
# SES send rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/SES \
  --metric-name Send \
  --dimensions Name=Environment,Value=production \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-31T23:59:59Z \
  --period 86400 \
  --statistics Sum
```

### Set Up Alerts

```bash
# Alert on delivery failures
aws cloudwatch put-metric-alarm \
  --alarm-name SES-Delivery-Failures \
  --alarm-description "Alert on email delivery failures" \
  --metric-name Reputation.BounceRate \
  --namespace AWS/SES \
  --statistic Average \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

## Testing Checklist

Before enabling for real customers:

- [ ] SES identity verified (domain preferred)
- [ ] Production access approved (out of sandbox)
- [ ] Test booking sends client confirmation
- [ ] Test booking sends contractor notification
- [ ] Confirm action sends client "confirmed" email
- [ ] Decline action sends client "declined" email
- [ ] All links in emails work (especially dashboard links)
- [ ] Emails not going to spam
- [ ] CloudWatch logs show successful sends
- [ ] Bounce/complaint rates monitored

## Production Best Practices

1. **Use a dedicated sending domain** (e.g., `mail.jobdock.com`)
2. **Implement bounce/complaint handling** (SNS topics)
3. **Monitor sending quotas** (default: 200 emails/day, 1 email/sec)
4. **Request quota increase** if needed:
   ```bash
   aws service-quotas request-service-quota-increase \
     --service-code ses \
     --quota-code L-0B6E9F1A \
     --desired-value 10000
   ```
5. **Set up configuration sets** for tracking opens/clicks (optional)

## Next Steps

Once emails work in production:
1. Monitor delivery rates for first week
2. Adjust templates based on customer feedback
3. Consider transactional email service (SendGrid, Postmark) for very high volume
4. Add email preferences/unsubscribe functionality if sending marketing

For more details:
- AWS SES Documentation: https://docs.aws.amazon.com/ses/
- Email best practices: https://docs.aws.amazon.com/ses/latest/dg/tips-and-best-practices.html

