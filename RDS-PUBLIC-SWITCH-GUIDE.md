# RDS Public Switch Guide - Complete Context

## What We're Doing

Switching RDS database from **private subnet** to **public subnet** to eliminate NAT Gateway costs.

**Goal:** Save $60-80/month by removing NAT Gateway requirement

## Why This Change?

### Current Problem:
- Lambda functions are in VPC private subnet (to access RDS)
- Lambda needs internet access (for Cognito, Secrets Manager, external APIs)
- This requires NAT Gateway = $32/month base + $20-50/month data transfer = **$52-82/month**

### Solution:
- Move RDS to public subnet
- Remove VPC requirement from Lambda (or keep VPC but no NAT Gateway needed)
- Use security groups to restrict database access to Lambda only
- **Savings: $60-80/month**

## Current Infrastructure

### Database Configuration:
- **Location:** `infrastructure/lib/jobdock-stack.ts` (lines 228-250)
- **Current:** RDS in private subnet
- **Removal Policy:** RETAIN for prod (database won't be deleted)
- **Backups:** 1 day retention (automated)
- **Security:** Security groups restrict to Lambda only ✅

### Lambda Configuration:
- **Location:** `infrastructure/lib/jobdock-stack.ts` (lines 527-572, 577-620)
- **Current:** Lambda in VPC private subnet
- **Functions:** auth, data, migrate, cleanup-jobs
- **All functions:** Currently in VPC with `vpc: this.vpc` and `vpcSubnets: privateSubnetSelection`

### Network Configuration:
- **Location:** `infrastructure/lib/jobdock-stack.ts` (lines 45-186)
- **Current:** Full VPC with NAT Gateway
- **Cost:** $52-82/month for NAT Gateway

## Safety Measures

### Already in Place:
1. ✅ **RDS Removal Policy:** RETAIN for prod (line 244) - database won't be deleted
2. ✅ **Automated Backups:** 1 day retention (line 245) - can restore if needed
3. ✅ **Security Groups:** Already restrict to Lambda only (lines 206-210)
4. ✅ **Encryption:** Enabled (line 247)
5. ✅ **Secrets Manager:** Credentials stored securely

### Before Starting:
1. **Create manual backup** (user should do this first)
2. **Test in dev environment** (if available)
3. **Review code changes** before deploying
4. **Deploy during low traffic** period

## Code Changes Needed

### 1. Update RDS Configuration (`infrastructure/lib/jobdock-stack.ts`)

**Find:** Line 240 (around there)
```typescript
vpcSubnets: privateSubnetSelection,
```

**Change to:**
```typescript
vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
publiclyAccessible: true,  // Add this line
```

**Also update:** Line 218 (database subnet group)
```typescript
// Change from:
vpcSubnets: privateSubnetSelection,

// To:
vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
```

### 2. Remove VPC from Lambda Functions (Optional but Recommended)

**Find:** Lines 532-534, 582-584 (and similar for other Lambda functions)
```typescript
vpc: this.vpc,
vpcSubnets: privateSubnetSelection,
securityGroups: [lambdaSecurityGroup],
```

**Change to:**
```typescript
// Remove VPC entirely - Lambda can access public RDS directly
// Remove these lines:
// vpc: this.vpc,
// vpcSubnets: privateSubnetSelection,
// securityGroups: [lambdaSecurityGroup],
```

**Note:** Security groups will still work - they'll be attached to RDS, not Lambda

### 3. Remove NAT Gateway (After Lambda VPC Removal)

**Find:** Lines 140-159 (NAT Gateway creation)
**Action:** Comment out or remove NAT Gateway creation code

**Also remove:** Lines 164-186 (NAT routes)

### 4. Keep Security Groups (Don't Change!)

**Keep:** Lines 192-210 (Security groups)
- Database security group restricting to Lambda ✅
- This is critical for security!

## Step-by-Step Plan

### Phase 1: Preparation (User Does This)
1. **Create manual backup:**
   ```powershell
   # Get RDS instance ID first
   aws rds describe-db-instances --region us-east-1 --query "DBInstances[*].DBInstanceIdentifier" --output text
   
   # Create snapshot
   aws rds create-db-snapshot `
     --db-instance-identifier YOUR-RDS-INSTANCE-ID `
     --db-snapshot-identifier pre-public-switch-$(Get-Date -Format "yyyyMMdd") `
     --region us-east-1
   ```

2. **Verify current security groups:**
   - Check that only Lambda security group can access RDS
   - Test from your IP (should fail - good!)

### Phase 2: Code Changes (AI Does This, User Reviews)
1. Update RDS subnet configuration
2. Add `publiclyAccessible: true`
3. Remove VPC from Lambda functions
4. Remove NAT Gateway code
5. User reviews changes before deploying

### Phase 3: Testing (User Does This)
1. **Test in dev environment first** (if available)
2. Deploy to dev
3. Test all database operations
4. Verify security groups block unauthorized access
5. Verify cost reduction

### Phase 4: Production Deployment (User Does This)
1. Deploy during low-traffic period
2. Monitor CloudWatch logs
3. Test all functionality
4. Verify cost reduction in AWS Console

### Phase 5: Verification (User Does This)
1. ✅ Test Lambda → RDS connection
2. ✅ Test all database operations (CRUD)
3. ✅ Verify security groups block unauthorized access
4. ✅ Check CloudWatch for errors
5. ✅ Verify NAT Gateway is removed (cost should drop)

## Rollback Plan

### If Something Goes Wrong:

**Option 1: Code Rollback (5 minutes)**
```powershell
git revert HEAD
cd infrastructure
npm run deploy:prod
```

**Option 2: Restore from Snapshot (15-30 minutes)**
```powershell
aws rds restore-db-instance-from-db-snapshot `
  --db-instance-identifier YOUR-RDS-INSTANCE-ID `
  --db-snapshot-identifier pre-public-switch-YYYYMMDD `
  --region us-east-1
```

**Option 3: Manual Fix (10 minutes)**
- Fix security groups in AWS Console
- Adjust subnet configuration
- No data loss, just configuration fix

## Expected Results

### Before:
- Cost: ~$110/month
- NAT Gateway: $52-82/month
- RDS: $15-20/month
- Other: $20-30/month

### After:
- Cost: ~$35-50/month
- RDS: $15-20/month
- Other: $20-30/month
- **Savings: $60-80/month** 🎉

## Security Notes

### Public RDS Security:
- ✅ Database has public endpoint BUT...
- ✅ Security groups restrict access to Lambda only
- ✅ All other traffic is blocked
- ✅ Still encrypted (SSL/TLS)
- ✅ Credentials in Secrets Manager
- ✅ **Still secure with proper configuration**

### Security Groups (Critical!):
- Must restrict to Lambda security group only
- Already configured correctly in code
- Will continue to work after switch

## Files to Modify

1. **`infrastructure/lib/jobdock-stack.ts`**
   - RDS configuration (lines ~228-250)
   - Lambda functions (lines ~527-620)
   - NAT Gateway code (lines ~140-186)
   - Security groups (lines ~192-210) - **DON'T CHANGE**

2. **No application code changes needed**
3. **No database schema changes**
4. **No data changes**

## Important Notes

- **No data loss risk** - We're only changing network configuration
- **Backups protect you** - Can restore if needed
- **Removal policy protects** - Database won't be deleted
- **Security groups work** - Already configured correctly
- **Reversible** - Can rollback easily

## Current State Summary

- **Environment:** Production (`prod`)
- **Region:** us-east-1
- **Database:** RDS PostgreSQL t3.micro
- **Lambda:** 4 functions (auth, data, migrate, cleanup-jobs)
- **Current Cost:** ~$110/month
- **Target Cost:** ~$35-50/month
- **Savings:** $60-80/month

## Next Steps for New Chat

1. Read this document
2. Review current code in `infrastructure/lib/jobdock-stack.ts`
3. Make the code changes described above
4. Show user the changes for review
5. Guide user through deployment process
6. Help verify everything works

## Questions to Ask User

1. Do you have a dev environment to test in first?
2. When is a good low-traffic time to deploy?
3. Do you want to create the backup first, or should I guide you?
4. Do you want me to make all changes at once, or step-by-step?

---

**Status:** Ready to proceed
**Risk Level:** Low (with proper precautions)
**Estimated Time:** 2-4 hours total (including testing)
**Savings:** $60-80/month
