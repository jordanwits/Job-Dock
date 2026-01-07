# Production Environment Setup

This guide ensures your booking and scheduling features work against live AWS infrastructure instead of mocks.

## Prerequisites

1. AWS CDK stack deployed (dev or prod)
2. Database migrations applied
3. AWS CLI configured with appropriate credentials

## Step 1: Sync AWS Environment Variables

Run the sync script to automatically populate environment variables from your deployed stack:

```bash
# For dev environment (default)
npm run sync:aws:env -- --env=dev --region=us-east-1

# For production environment
npm run sync:aws:env -- --env=prod --region=us-east-1
```

This script will:
- Query your AWS CloudFormation stack outputs
- Write frontend `.env` with `VITE_API_URL`, Cognito IDs, S3 bucket names
- Write backend `.env` with database credentials, API URLs, tenant settings

## Step 2: Configure Frontend for Live Data

Ensure your frontend `.env` file contains:

```env
# CRITICAL: Set to false for live AWS data
VITE_USE_MOCK_DATA=false

# These should be auto-populated by sync:aws:env
VITE_API_URL=https://your-api-gateway-url/dev
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_S3_BUCKET=jobdock-files-dev-XXXXXXXXXXXX
VITE_DEFAULT_TENANT_ID=demo-tenant
```

### Verify Data Mode

After setting `VITE_USE_MOCK_DATA=false`:

1. Restart your dev server: `npm run dev`
2. Open the app in your browser
3. Look for the **Data Source** indicator at the top of authenticated pages
4. It should show: **Live · AWS** (green indicator)
5. If it shows **Mock · Local**, check your `.env` file and restart the server

## Step 3: Configure Backend Environment

Your backend `.env` should contain (auto-populated by sync:aws:env):

```env
DATABASE_URL=postgresql://dbadmin:password@localhost:5432/jobdock?schema=public
DATABASE_SECRET_ARN=arn:aws:secretsmanager:...
DATABASE_ENDPOINT=your-db-endpoint.rds.amazonaws.com
DATABASE_HOST=your-db-endpoint.rds.amazonaws.com
DATABASE_NAME=jobdock
DATABASE_PORT=5432

USER_POOL_ID=us-east-1_XXXXXXXXX
USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
FILES_BUCKET=jobdock-files-dev-XXXXXXXXXXXX

ENVIRONMENT=dev
PUBLIC_APP_URL=http://localhost:5173
DEFAULT_TENANT_ID=demo-tenant

# Email configuration (set by CDK)
SES_ENABLED=false
SES_REGION=us-east-1
SES_FROM_ADDRESS=noreply@jobdock.dev
```

## Step 4: Verify Live Connection

### Test Scheduling Features

1. Log in to your app
2. Navigate to **Scheduling** tab
3. Create a new service with working hours
4. Create a job and verify it persists after refresh
5. Check browser DevTools Network tab - you should see requests to your API Gateway URL (not localhost:8000)

### Test Public Booking

1. In Scheduling → Services, click "Get Link" on a service
2. Copy the booking link
3. Open it in a new incognito window
4. Select a time slot and book
5. Verify the booking appears in your Scheduling calendar
6. Check CloudWatch logs for the booking request

## Step 5: Environment-Specific Configuration

### Dev Environment (for testing)

```env
# Frontend
VITE_USE_MOCK_DATA=false
VITE_API_URL=https://peodg7kg97.execute-api.us-east-1.amazonaws.com/dev

# Backend (via CDK)
SES_ENABLED=false  # Emails log to CloudWatch only
```

### Production Environment

```env
# Frontend
VITE_USE_MOCK_DATA=false
VITE_API_URL=https://api.yourdomain.com

# Backend (via CDK)
SES_ENABLED=true  # Real emails sent via SES
PUBLIC_APP_URL=https://yourdomain.com
```

## Troubleshooting

### "Data Source: Mock · Local" still showing

- Verify `.env` has `VITE_USE_MOCK_DATA=false`
- Restart dev server completely (`npm run dev`)
- Clear browser localStorage: `localStorage.removeItem('jobdock:data-mode')`
- Hard refresh browser (Ctrl+Shift+R)

### API requests failing

- Check API Gateway URL in `.env` matches CloudFormation output
- Verify you're logged in (Cognito token present)
- Check browser console for CORS errors
- Verify Lambda functions deployed with latest code

### Bookings not appearing

- Check CloudWatch logs for Lambda errors
- Verify database migrations ran successfully
- Ensure tenant ID matches (`DEFAULT_TENANT_ID`)
- Check `X-Tenant-ID` header in API requests

## Next Steps

Once live data is confirmed working:
1. Test email notifications (see email configuration section)
2. Run end-to-end booking tests
3. Configure production domain and SSL
4. Enable SES for production emails

For more details, see:
- `LIVE_DATA_SETUP.md` - Full AWS setup guide
- `PRODUCTION_READINESS.md` - Production deployment checklist
- `PUBLIC_BOOKING_FEATURE.md` - Booking flow documentation

