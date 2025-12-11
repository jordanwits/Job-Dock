# Next Steps - AWS Deployment

You've got your AWS account set up! Here's what to do next:

## Immediate Next Steps (Today)

### 1. Install Prerequisites (5 minutes)

```bash
# Install AWS CLI (if not already installed)
# Windows: Download from https://aws.amazon.com/cli/
# Mac: brew install awscli
# Linux: sudo apt install awscli

# Install AWS CDK
npm install -g aws-cdk

# Verify installations
aws --version
cdk --version
```

### 2. Configure AWS CLI (2 minutes)

```bash
aws configure
```

You'll need:
- AWS Access Key ID (from IAM → Users → Your User → Security Credentials)
- AWS Secret Access Key
- Default region: `us-east-1`
- Output format: `json`

### 3. Deploy Infrastructure (20 minutes)

```bash
cd infrastructure
npm install
cdk bootstrap
npm run deploy:dev
```

**What this does:**
- Creates VPC with networking
- Sets up Aurora Serverless database (auto-scales)
- Creates Cognito User Pool for authentication
- Sets up API Gateway
- Creates S3 buckets for frontend and files
- Creates CloudFront CDN
- Sets up Lambda functions (placeholder)

**Cost:** ~$60/month for development (mostly free tier)

### 4. Save Output Values (2 minutes)

After deployment, CDK outputs important values. **Copy these!**

You'll see:
- API URL
- Cognito User Pool ID
- Cognito Client ID
- Database endpoint
- S3 bucket names

### 5. Set Up Database (10 minutes)

```bash
# Get database password
aws secretsmanager get-secret-value \
  --secret-id jobdock-db-credentials-dev \
  --query SecretString \
  --output text

# Set up backend
cd backend
npm install
npx prisma generate

# Update backend/.env with database connection
# Then run migrations
npx prisma migrate deploy
```

## This Week

### Day 1-2: Infrastructure ✅
- [x] Deploy AWS infrastructure
- [ ] Set up database
- [ ] Test API Gateway connectivity

### Day 3-4: Backend Development
- [ ] Implement real Lambda functions (replace placeholders)
- [ ] Connect authentication to Cognito
- [ ] Test database queries

### Day 5: Frontend Integration
- [ ] Update frontend to use real API
- [ ] Connect authentication flow
- [ ] Test end-to-end user flow

## This Month

### Week 1: Core Features
- [ ] Authentication working end-to-end
- [ ] Contacts CRUD operations
- [ ] Basic error handling

### Week 2: More Features
- [ ] Quotes management
- [ ] Invoices management
- [ ] File uploads to S3

### Week 3: Scheduling
- [ ] Jobs/scheduling features
- [ ] Calendar integration
- [ ] Notifications

### Week 4: Polish & Deploy
- [ ] Error handling improvements
- [ ] Performance optimization
- [ ] Deploy to staging
- [ ] User testing

## Important Files Created

### Infrastructure
- `infrastructure/` - AWS CDK code
- `infrastructure/config.ts` - Environment configuration
- `infrastructure/lib/jobdock-stack.ts` - Main infrastructure stack

### Backend
- `backend/` - Lambda functions and API
- `backend/prisma/schema.prisma` - Database schema (multi-tenant)
- `backend/src/lib/` - Shared utilities (db, auth, middleware)

### Documentation
- `AWS_SETUP_GUIDE.md` - Step-by-step AWS setup
- `infrastructure/README.md` - Infrastructure details
- `backend/README.md` - Backend API docs

## Quick Commands Reference

```bash
# Infrastructure
cd infrastructure
npm run deploy:dev      # Deploy to dev
npm run deploy:staging   # Deploy to staging
npm run deploy:prod      # Deploy to production
cdk diff                 # Preview changes
cdk destroy              # Delete infrastructure (careful!)

# Backend
cd backend
npm run build            # Build TypeScript
npm run dev              # Watch mode
npx prisma studio        # Database GUI
npx prisma migrate dev   # Create migration
npx prisma migrate deploy # Apply migrations

# Frontend
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build
```

## Cost Management

### Development (~$60/month)
- Aurora Serverless: ~$50 (minimal usage)
- Lambda: ~$5 (1M requests)
- API Gateway: ~$3.50 (1M requests)
- S3: ~$1
- CloudFront: ~$1

### Production (~$275-575/month for 1000+ users)
- Aurora Serverless: ~$200-500 (scales with usage)
- Lambda: ~$20 (10M requests)
- API Gateway: ~$35 (10M requests)
- S3: ~$10
- CloudFront: ~$10

**Set up billing alerts!** AWS Console → Billing → Preferences

## Security Checklist

- [x] Database in private subnet
- [x] S3 buckets block public access
- [x] API Gateway rate limiting
- [x] Cognito strong password policy
- [x] Lambda least privilege IAM roles
- [x] Encryption at rest and in transit

## Need Help?

1. **AWS Setup Issues**: Check `AWS_SETUP_GUIDE.md`
2. **Database Issues**: Check `backend/README.md`
3. **Infrastructure Issues**: Check `infrastructure/README.md`
4. **AWS Docs**: https://docs.aws.amazon.com/
5. **Prisma Docs**: https://www.prisma.io/docs

## Success Criteria

You'll know you're ready when:
- ✅ Infrastructure deployed successfully
- ✅ Database migrations run
- ✅ API Gateway returns responses
- ✅ Can connect to database from Lambda
- ✅ Frontend can call API endpoints
- ✅ Authentication flow works

## What Makes This Scalable?

1. **Serverless**: Lambda auto-scales to handle any load
2. **Aurora Serverless**: Database scales from 0.5 to 16 ACU automatically
3. **Multi-tenant**: Database-level isolation supports unlimited tenants
4. **CDN**: CloudFront caches static assets globally
5. **Monitoring**: CloudWatch tracks everything
6. **High Availability**: Multi-AZ deployment

You're building for scale from day one! 🚀

