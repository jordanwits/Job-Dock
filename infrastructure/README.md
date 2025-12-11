# AWS Infrastructure Setup Guide

This guide will help you set up a scalable, production-ready AWS infrastructure for JobDock that can handle thousands of users.

## Architecture Overview

### Serverless-First Approach (Recommended for Scale)

```
┌─────────────┐
│   CloudFront│  ← CDN for static assets
└──────┬──────┘
       │
┌──────▼──────┐
│  S3 Bucket │  ← Frontend hosting
└────────────┘

┌─────────────┐
│API Gateway  │  ← API endpoint
└──────┬──────┘
       │
┌──────▼──────┐
│   Lambda    │  ← Serverless functions (auto-scales)
└──────┬──────┘
       │
┌──────▼──────┐
│Aurora Serverless│ ← Auto-scaling database
└─────────────┘

┌─────────────┐
│   Cognito   │  ← User authentication
└─────────────┘

┌─────────────┐
│   S3        │  ← File storage (documents, images)
└─────────────┘
```

## Why This Architecture?

1. **Auto-Scaling**: Lambda and Aurora Serverless automatically scale based on demand
2. **Cost-Effective**: Pay only for what you use
3. **High Availability**: Built-in redundancy across multiple AZs
4. **Multi-Tenant Ready**: Database-level tenant isolation
5. **Production Ready**: Includes monitoring, logging, and security

## Prerequisites

1. AWS Account with admin access
2. AWS CLI installed and configured
3. Node.js 18+ installed
4. AWS CDK CLI installed: `npm install -g aws-cdk`

## Setup Steps

### Step 1: Install Dependencies

```bash
cd infrastructure
npm install
```

### Step 2: Configure AWS Credentials

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter your default region (e.g., us-east-1)
# Enter default output format (json)
```

### Step 3: Bootstrap CDK (First Time Only)

```bash
cdk bootstrap
```

### Step 4: Review Configuration

Edit `infrastructure/config.ts` to set:
- Environment (dev/staging/prod)
- Region
- Domain name (if you have one)
- Email for SES (if using email)

### Step 5: Deploy Infrastructure

```bash
# Deploy to dev environment
npm run deploy:dev

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod
```

## What Gets Created

### 1. VPC & Networking
- VPC with public and private subnets
- NAT Gateway for Lambda internet access
- Security groups

### 2. Database (Aurora Serverless v2)
- PostgreSQL database cluster
- Auto-scaling from 0.5 ACU to 16 ACU
- Multi-AZ for high availability
- Automated backups (7 days retention)
- Encryption at rest

### 3. Authentication (Cognito)
- User pool for authentication
- User pool client for frontend
- Password policies
- Email verification
- MFA support (optional)

### 4. API Gateway
- REST API endpoint
- CORS configuration
- Rate limiting
- Request validation

### 5. Lambda Functions
- Auth handler (login, register, refresh)
- Contacts handler (CRUD operations)
- Quotes handler
- Invoices handler
- Jobs handler
- Services handler

### 6. S3 Buckets
- Frontend hosting bucket
- File storage bucket (documents, images)
- CloudFront distribution for CDN

### 7. CloudWatch
- Log groups for each Lambda
- Alarms for errors
- Metrics dashboard

### 8. IAM Roles
- Lambda execution roles
- Database access roles
- S3 access roles

## Multi-Tenant Architecture

Every database table includes `tenant_id` for data isolation:

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  -- other fields
  INDEX idx_tenant_id (tenant_id)
);
```

## Environment Variables

After deployment, you'll get output values:

```bash
# Copy these to your .env file
VITE_API_URL=https://your-api-id.execute-api.region.amazonaws.com/prod
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxx
VITE_COGNITO_CLIENT_ID=xxxxx
VITE_AWS_REGION=us-east-1
VITE_S3_BUCKET=jobdock-files-prod
```

## Cost Estimation

### Development (Low Traffic)
- Aurora Serverless: ~$50/month (minimal usage)
- Lambda: ~$5/month (1M requests)
- API Gateway: ~$3.50/month (1M requests)
- S3: ~$1/month (storage)
- CloudFront: ~$1/month
- **Total: ~$60/month**

### Production (1000+ users)
- Aurora Serverless: ~$200-500/month (scales with usage)
- Lambda: ~$20/month (10M requests)
- API Gateway: ~$35/month (10M requests)
- S3: ~$10/month
- CloudFront: ~$10/month
- **Total: ~$275-575/month**

## Security Best Practices

1. **Database**: Private subnets only, no public access
2. **Lambda**: Least privilege IAM roles
3. **API Gateway**: Rate limiting and request validation
4. **S3**: Private buckets with presigned URLs
5. **Cognito**: Strong password policies, MFA support
6. **Encryption**: All data encrypted at rest and in transit

## Monitoring

- CloudWatch Logs: All Lambda logs
- CloudWatch Metrics: API latency, errors, database connections
- CloudWatch Alarms: Alert on errors or high latency

## Next Steps

1. Deploy infrastructure
2. Run database migrations
3. Connect frontend to API
4. Test authentication flow
5. Deploy backend Lambda functions

## Troubleshooting

### CDK Deployment Fails
- Check AWS credentials: `aws sts get-caller-identity`
- Ensure you have admin permissions
- Check CloudFormation console for errors

### Database Connection Issues
- Verify security groups allow Lambda access
- Check database endpoint in Lambda environment variables
- Verify IAM role has database access

### API Gateway CORS Errors
- Check CORS configuration in API Gateway
- Verify frontend URL is in allowed origins

## Support

For issues or questions, check:
- AWS CDK Documentation: https://docs.aws.amazon.com/cdk/
- AWS Lambda Documentation: https://docs.aws.amazon.com/lambda/
- Aurora Serverless Documentation: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless.html

