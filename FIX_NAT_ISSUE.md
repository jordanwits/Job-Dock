# Fix NAT Instance Issue - Login Timeout

## Problem

The Lambda function is timing out when trying to connect to Cognito because it can't reach the internet. The error shows:

- `ETIMEDOUT` after ~50 seconds
- `internalConnectMultiple` - network connection timeout
- Lambda is in VPC private subnet and needs NAT to reach internet

## Root Cause

The NAT Instance (cost-optimized) is either:

1. Stopped/terminated
2. Not properly routing traffic
3. Security group misconfigured

## Solution: Switch to NAT Gateway

I've updated the config to use NAT Gateway instead of NAT Instance for production. NAT Gateway is:

- ✅ More reliable (managed service)
- ✅ Automatically scales
- ✅ No instance management needed
- ⚠️ Costs ~$32/month vs ~$3/month for NAT Instance

## Deploy the Fix

```powershell
cd infrastructure
npm run deploy:prod
```

This will:

1. Create NAT Gateway(s) for production
2. Update route tables to use NAT Gateway
3. Remove/replace the NAT Instance
4. Lambda will be able to reach Cognito and other internet services

## Alternative: Check NAT Instance Status (if you want to keep using it)

If you prefer to keep the NAT Instance (to save costs), check its status:

1. Go to AWS Console → EC2 → Instances
2. Search for instances with name containing "NAT" or "JobDockStack-prod"
3. Check if it's "running" or "stopped"
4. If stopped, start it:
   - Select the instance
   - Click "Instance state" → "Start instance"
5. Wait 1-2 minutes for it to fully start
6. Try login again

## Verify Fix

After deploying, check the logs again:

1. Try logging in
2. Check CloudWatch logs for the Auth Lambda
3. Look for `[Login] Step 1 complete` - should show timing < 2 seconds
4. Should see `[Login] Success!` instead of timeout error

## Cost Comparison

- **NAT Instance**: ~$3/month (t4g.nano) but requires management
- **NAT Gateway**: ~$32/month + data transfer, but fully managed

For production, NAT Gateway is recommended for reliability.
