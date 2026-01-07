# CloudWatch Email Logs Guide - Free Tier

## Your Configuration

**Lambda Function:** `JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc`  
**CloudWatch Log Group:** `/aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc`  
**SES Status:** Disabled (dev mode) - Emails log to CloudWatch instead of sending

---

## 🎯 Quick Access: View Email Logs

### Option 1: Command Line (Easiest - Real-time)

**Watch logs in real-time as bookings happen:**
```bash
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --follow
```

**Filter to show ONLY emails:**
```bash
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --follow --filter-pattern "EMAIL"
```

**View last 10 minutes of logs:**
```bash
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --since 10m
```

### Option 2: AWS Console (Visual Interface)

1. **Go to AWS Console:** https://console.aws.amazon.com/cloudwatch/
2. **Navigate to:** Logs → Log groups
3. **Find:** `/aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc`
4. **Click** on the log group
5. **Select** the most recent log stream (top of list)
6. **Search** for "EMAIL" or "📧" to find email logs

---

## 📧 What Email Logs Look Like

### Example: Pending Confirmation Email
```
📧 =============== EMAIL (Dev Mode) ===============
To: client@example.com
From: noreply@jobdock.dev
Subject: Booking request received - Test Consultation
---
Hi Test Client,

We've received your booking request for:

Service: Test Consultation
Date: Tuesday, January 7, 2026
Time: 10:00 AM

Your request is pending confirmation. We'll send you another email once it's confirmed.

Thank you for your patience!
================================================
```

### Example: Confirmation Email (After Approve)
```
📧 =============== EMAIL (Dev Mode) ===============
To: client@example.com
From: noreply@jobdock.dev
Subject: Your booking has been confirmed - Test Consultation
---
Hi Test Client,

Great news! Your booking request has been confirmed.

Service: Test Consultation
Date: Tuesday, January 7, 2026
Time: 10:00 AM - 11:00 AM

We look forward to seeing you!
================================================
```

### Example: Contractor Notification
```
📧 =============== EMAIL (Dev Mode) ===============
To: jordan@westwavecreative.com
From: noreply@jobdock.dev
Subject: New booking request for Test Consultation
---
Hi Jordan,

You have a new booking request for Test Consultation.

Client: Test Client
Email: client@example.com
Phone: 555-1234
Service: Test Consultation
Date: Tuesday, January 7, 2026
Time: 10:00 AM - 11:00 AM

⚠️ This booking requires your confirmation. Please log in to your dashboard to confirm or decline.

View in Dashboard: http://localhost:3000/scheduling
================================================
```

---

## 🔍 Search Patterns

### Find Specific Email Types

**All emails:**
```bash
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --follow --filter-pattern "📧"
```

**Confirmation emails only:**
```bash
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --follow --filter-pattern "confirmed"
```

**Pending emails only:**
```bash
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --follow --filter-pattern "pending confirmation"
```

**Declined emails only:**
```bash
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --follow --filter-pattern "declined"
```

**Contractor notifications only:**
```bash
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --follow --filter-pattern "View in Dashboard"
```

---

## 🧪 Test It Now

### Step-by-Step Test:

**1. Start watching logs** (in a terminal window):
```bash
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --follow --filter-pattern "EMAIL"
```

**2. In your browser** at `http://localhost:3000`:
- Create a public booking (use an incognito window)
- Submit the form

**3. Watch the terminal:**
You should immediately see 2 email logs appear:
- ✅ Client email (pending or confirmed)
- ✅ Contractor notification

**4. Confirm the booking** in your admin panel

**5. Watch the terminal again:**
You should see 1 more email log:
- ✅ Client confirmation email

---

## 📊 Free Tier Considerations

### CloudWatch Logs Free Tier Includes:
- ✅ **5 GB** of log ingestion per month
- ✅ **5 GB** of log storage (first month free)
- ✅ **Unlimited** log queries

### Your Usage:
- Each email log is ~500 bytes
- 1000 bookings = ~0.5 MB of logs
- **You can log thousands of emails within free tier!** ✅

### Storage:
- Logs are retained for the duration you configure (default: usually 7 days)
- Old logs automatically delete
- Very low cost even beyond free tier (~$0.50 per GB)

---

## 🔧 Advanced: View Logs by Time Range

### Last hour:
```bash
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --since 1h
```

### Last 30 minutes:
```bash
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --since 30m
```

### Specific time range:
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc \
  --start-time $(date -u -d '2 hours ago' +%s)000 \
  --filter-pattern "EMAIL"
```

---

## 🐛 Troubleshooting

### Issue: No logs appearing

**Check if Lambda is being invoked:**
```bash
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --follow
```
Create a booking and watch for ANY output.

**If you see logs but no emails:**
1. Check if SES_ENABLED is false:
```bash
aws lambda get-function-configuration \
  --function-name JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc \
  --query 'Environment.Variables.SES_ENABLED'
```
Should return `"false"` for dev mode.

2. Check if emails are in a different format:
```bash
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --follow --filter-pattern "email"
```

### Issue: Permission denied

**If you get permission errors:**
```bash
# Check your AWS credentials
aws sts get-caller-identity

# Make sure you have CloudWatch Logs permissions
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/JobDock
```

### Issue: Log group not found

**List all Lambda log groups:**
```bash
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/JobDock
```

---

## 📝 Quick Reference Commands

**Copy-paste ready commands for daily use:**

```bash
# Watch all logs in real-time
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --follow

# Watch ONLY email logs
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --follow --filter-pattern "EMAIL"

# View last 30 minutes
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --since 30m

# Count emails sent today
aws logs filter-log-events \
  --log-group-name /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc \
  --filter-pattern "📧" \
  --start-time $(date -u -d 'today' +%s)000 | grep -c "EMAIL"
```

---

## 🚀 Production: Real Emails

When you're ready to send **real emails** (after free tier or for production):

1. **Verify SES identity** (see `SES_EMAIL_CONFIGURATION.md`)
2. **Request SES production access** (move out of sandbox)
3. **Update CDK config** for prod environment:
   ```typescript
   prod: {
     // This will set SES_ENABLED=true
   }
   ```
4. **Deploy:** `cd infrastructure && npm run deploy:prod`

Then emails will actually send via SES instead of logging!

---

## 💡 Pro Tips

### Keep logs open while testing
```bash
# Split your terminal or use a second window
# Window 1: Watch logs
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --follow --filter-pattern "EMAIL"

# Window 2: Run your tests
# Create bookings, confirm them, etc.
```

### Save logs to file
```bash
# Capture logs for debugging
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --since 1h > email-logs.txt
```

### Check Lambda errors too
```bash
# Watch for both emails and errors
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --follow --filter-pattern "EMAIL|ERROR"
```

---

## ✅ Verification Checklist

Test your email logging setup:

- [ ] Start log tail command in terminal
- [ ] Create a test booking
- [ ] See 2 emails in logs (client + contractor)
- [ ] Confirm the booking
- [ ] See 1 more email in logs (confirmation)
- [ ] Decline a different booking
- [ ] See 1 more email in logs (declined)

If all checked, **your email system is working perfectly!** ✅

---

**Quick Start Command:**
```bash
aws logs tail /aws/lambda/JobDockStack-dev-DataLambda06623DA9-VGbcKOqBjqbc --follow --filter-pattern "EMAIL"
```

**Then create a booking and watch the magic happen!** 🎉

