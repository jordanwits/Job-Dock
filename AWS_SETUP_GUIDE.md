# AWS Setup Guide - Quick Start

This guide will walk you through setting up your AWS infrastructure for JobDock.

## Prerequisites

1. ✅ AWS Account (you have this!)
2. AWS CLI installed: https://aws.amazon.com/cli/
3. Node.js 18+ installed
4. AWS CDK CLI: `npm install -g aws-cdk`

## Step 1: Configure AWS CLI

```bash
aws configure
```

Enter:
- **AWS Access Key ID**: Get from AWS Console → IAM → Users → Security Credentials
- **AWS Secret Access Key**: Same location
- **Default region**: `us-east-1` (or your preferred region)
- **Output format**: `json`

Verify it works:
```bash
aws sts get-caller-identity
```

## Step 2: Install Infrastructure Dependencies

```bash
cd infrastructure
npm install
```

## Step 3: Bootstrap CDK (First Time Only)

CDK needs to create resources in your account:

```bash
cdk bootstrap
```

This creates:
- S3 bucket for CDK assets
- IAM roles for deployment
- CloudFormation stack

## Step 4: Review Configuration

Edit `infrastructure/config.ts` to customize:
- Region (default: us-east-1)
- Database capacity (min/max ACU)
- Lambda memory/timeout
- Password policies

For now, defaults are fine for development.

## Step 5: Deploy Infrastructure

Deploy to development environment:

```bash
npm run deploy:dev
```

**This will take 15-20 minutes** - CDK is creating:
- VPC with networking
- Aurora Serverless database
- Cognito User Pool
- API Gateway
- S3 buckets
- CloudFront distribution
- Lambda functions (placeholder)

## Step 6: Save Output Values

After deployment completes, CDK will output important values:

```bash
# Copy these values - you'll need them!
Outputs:
JobDockStack-dev.ApiUrl = https://xxxxx.execute-api.us-east-1.amazonaws.com/dev
JobDockStack-dev.UserPoolId = us-east-1_xxxxx
JobDockStack-dev.UserPoolClientId = xxxxx
JobDockStack-dev.DatabaseSecretArn = arn:aws:secretsmanager:...
JobDockStack-dev.DatabaseEndpoint = xxxxx.cluster-xxxxx.us-east-1.rds.amazonaws.com
JobDockStack-dev.FilesBucketName = jobdock-files-dev-xxxxx
```

## Step 7: Update Environment Variables

Create `.env` file in project root:

```bash
# From CDK outputs
VITE_API_URL=https://xxxxx.execute-api.us-east-1.amazonaws.com/dev
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxx
VITE_COGNITO_CLIENT_ID=xxxxx
VITE_AWS_REGION=us-east-1
VITE_S3_BUCKET=jobdock-files-dev-xxxxx
VITE_DEFAULT_TENANT_ID=demo-tenant

# For backend
DATABASE_SECRET_ARN=arn:aws:secretsmanager:...
DATABASE_CLUSTER_ENDPOINT=xxxxx.cluster-xxxxx.us-east-1.rds.amazonaws.com
DATABASE_NAME=jobdock
USER_POOL_ID=us-east-1_xxxxx
USER_POOL_CLIENT_ID=xxxxx
FILES_BUCKET=jobdock-files-dev-xxxxx
ENVIRONMENT=dev
DEFAULT_TENANT_ID=demo-tenant
```

## Step 8: Set Up Database

### Get Database Credentials

```bash
# Get database password from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id jobdock-db-credentials-dev \
  --query SecretString \
  --output text
```

### Install Prisma CLI

```bash
cd backend
npm install
npx prisma generate
```

### Create Database Connection String

Update `backend/.env`:

```bash
DATABASE_URL="postgresql://dbadmin:PASSWORD@ENDPOINT:5432/jobdock?schema=public"
```

Replace:
- `PASSWORD` with password from Secrets Manager
- `ENDPOINT` with DatabaseEndpoint from CDK outputs

### Run Migrations

```bash
npx prisma migrate deploy
```

This creates all tables with multi-tenant support.

## Step 9: Deploy Backend Functions

The infrastructure includes placeholder Lambda functions. You'll need to:

1. Build your Lambda functions
2. Package and deploy them
3. Update API Gateway routes

For now, the placeholder will work for testing connectivity.

## Step 10: Test the Setup

### Test API Gateway

```bash
curl https://YOUR_API_URL/dev/health
```

Should return: `{"message": "Lambda placeholder..."}`

### Test Database Connection

```bash
cd backend
npx prisma studio
```

Opens Prisma Studio at http://localhost:5555 - you can browse your database!

## What's Next?

1. **Connect Frontend**: Update frontend to use real API endpoints
2. **Implement Lambda Functions**: Replace placeholders with real handlers
3. **Set Up CI/CD**: Automate deployments
4. **Add Monitoring**: Set up CloudWatch dashboards
5. **Configure Domain**: Add custom domain (optional)

## Troubleshooting

### CDK Bootstrap Fails
- Check AWS credentials: `aws sts get-caller-identity`
- Ensure you have admin/root access
- Try: `cdk bootstrap --profile your-profile`

### Database Connection Fails
- Check security groups allow Lambda access
- Verify endpoint is correct
- Check credentials in Secrets Manager
- Ensure VPC has NAT Gateway for internet access

### API Gateway Returns 500
- Check CloudWatch Logs for Lambda errors
- Verify Lambda has correct environment variables
- Check IAM roles have necessary permissions

### Prisma Migrate Fails
- Verify DATABASE_URL is correct
- Check database is accessible from your IP (for local dev)
- Ensure database is in "available" state

## Cost Monitoring

Set up billing alerts:

1. AWS Console → Billing → Preferences
2. Enable "Receive Billing Alerts"
3. CloudWatch → Alarms → Create alarm
4. Metric: EstimatedCharges
5. Threshold: $50 (or your budget)

## Security Checklist

- [ ] Database is in private subnet ✅
- [ ] S3 buckets block public access ✅
- [ ] API Gateway has rate limiting ✅
- [ ] Cognito has strong password policy ✅
- [ ] Lambda has least privilege IAM roles ✅
- [ ] All data encrypted at rest ✅
- [ ] All data encrypted in transit ✅

## Support

- AWS CDK Docs: https://docs.aws.amazon.com/cdk/
- Prisma Docs: https://www.prisma.io/docs
- Aurora Serverless: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless.html

## Next: Connect Your Frontend

Once infrastructure is deployed, update your frontend to connect:

1. Update `.env` with API URL and Cognito IDs
2. Set `VITE_USE_MOCK_DATA=false` in `.env`
3. Test authentication flow
4. Test API endpoints

See `AUTH_IMPLEMENTATION.md` for Cognito integration details.

