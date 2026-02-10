# Fix Login Timeout Issue

## Problem

Login requests are timing out with 504 Gateway Timeout errors. The Lambda is exceeding its 30-second timeout limit.

## Changes Made

### 1. Infrastructure Changes (Need Deployment)

- ✅ Increased Lambda timeout from 30s to 60s for production
- ✅ Added Gateway Response for 504 errors with CORS headers
- ✅ Added performance logging to login handler

### 2. Frontend Changes (Already Applied)

- ✅ Switched login to use `publicApiClient` (no auth headers)
- ✅ Improved error messages for CORS and timeout errors
- ✅ Added comprehensive logging

## Step 1: Check Current Logs

Run this to see what's causing the timeout:

```powershell
.\check-auth-logs.ps1
```

Or manually:

```powershell
aws logs tail /aws/lambda/JobDockStack-prod-AuthLambda* --since 10m --format short
```

Look for:

- "Task timed out" - Lambda exceeded timeout
- "Step 1", "Step 2", "Step 3" - Performance breakdown
- Database connection errors
- Cognito authentication errors

## Step 2: Deploy Infrastructure Changes

The changes need to be deployed to take effect:

```powershell
cd infrastructure
npm run deploy -- --env=prod
```

This will:

1. Increase Lambda timeout to 60 seconds
2. Add Gateway Response for 504 errors with CORS headers
3. Deploy the updated Lambda with performance logging

## Step 3: Test After Deployment

1. Try logging in again
2. Check the logs to see which step is slow:
   ```powershell
   .\check-auth-logs.ps1
   ```
3. Look for the performance breakdown in logs:
   - Step 1: Cognito auth (should be < 2s)
   - Step 2: Token verification (should be < 1s)
   - Step 3: Database lookup (should be < 1s)

## Common Causes of Timeout

1. **Cold Start** - First request after inactivity can take 10-30s
   - Solution: Increased timeout to 60s should help
   - Long-term: Use provisioned concurrency

2. **Database Connection** - VPC Lambda connecting to RDS
   - Check: Look for database connection errors in logs
   - Solution: Connection pooling, check security groups

3. **Cognito Latency** - Network issues with Cognito
   - Check: Step 1 timing in logs
   - Solution: Usually resolves itself, but can add retry logic

4. **VPC Networking** - Lambda in VPC has slower cold starts
   - Check: Overall Lambda duration in CloudWatch
   - Solution: Consider moving Lambda out of VPC if possible

## Quick Fixes (If Deployment Not Possible)

1. **Wait and Retry** - Cold starts can take 30+ seconds
   - Wait 1 minute, then try again
   - Second request should be much faster

2. **Check Database** - Ensure RDS is running and accessible

   ```powershell
   aws rds describe-db-instances --query "DBInstances[?DBInstanceIdentifier=='*jobdock*'].DBInstanceStatus"
   ```

3. **Warm Up Lambda** - Make a health check request first
   ```powershell
   curl https://23sowpoo70.execute-api.us-east-1.amazonaws.com/prod/auth/health
   ```

## Next Steps

After deployment, monitor the logs to identify the bottleneck:

- If Step 1 (Cognito) is slow → Network/Cognito issue
- If Step 2 (Token verify) is slow → JWT verification issue
- If Step 3 (Database) is slow → Database connection issue

Then we can optimize the specific bottleneck.
