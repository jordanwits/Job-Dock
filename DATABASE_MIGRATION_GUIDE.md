# Database Migration Guide: RDS PostgreSQL → Aurora Serverless v2

## Overview

When you're ready to upgrade from regular RDS PostgreSQL (dev) to Aurora Serverless v2 (for better scaling), the migration is straightforward.

## Why It's Easy

### 1. **Same PostgreSQL Engine**
- Both use PostgreSQL 15.3
- Same SQL syntax and features
- Application code doesn't need to change

### 2. **Prisma Abstraction**
- Your Prisma schema works with both
- Connection strings are the only difference
- No code changes needed

### 3. **Infrastructure Already Supports Both**
- The CDK code already has Aurora Serverless v2 configuration
- Just change the config and redeploy

## Migration Steps (When Ready)

### Step 1: Update Config

Edit `infrastructure/config.ts`:

```typescript
dev: {
  env: 'dev',
  region: 'us-east-1',
  database: {
    engine: 'aurora-postgresql',
    minCapacity: 0.5, // Start small
    maxCapacity: 4,   // Can scale up
  },
  // ... rest of config
}
```

### Step 2: Create Database Snapshot

```bash
# Create snapshot of current RDS instance
aws rds create-db-snapshot \
  --db-instance-identifier jobdockstack-dev-database-xxxxx \
  --db-snapshot-identifier jobdock-migration-snapshot
```

### Step 3: Update Infrastructure Code

The code already supports Aurora! Just ensure dev uses Aurora:

```typescript
// In infrastructure/lib/jobdock-stack.ts
// Change the condition from:
if (config.env === 'dev') {
  // Use RDS
}
// To:
if (false) { // or remove the condition
  // Use RDS
}
```

### Step 4: Deploy New Infrastructure

```bash
cd infrastructure
npm run deploy:dev
```

This creates Aurora Serverless v2 cluster.

### Step 5: Restore Data

```bash
# Restore snapshot to Aurora cluster
aws rds restore-db-cluster-from-snapshot \
  --db-cluster-identifier jobdockstack-dev-database \
  --snapshot-identifier jobdock-migration-snapshot \
  --engine aurora-postgresql
```

### Step 6: Update Connection Strings

Update Lambda environment variables (they'll be updated automatically on redeploy).

### Step 7: Test & Switch Over

1. Test the new Aurora cluster
2. Update application to use new endpoint
3. Delete old RDS instance

## Alternative: Blue-Green Migration

For zero downtime:

1. **Create Aurora cluster** alongside existing RDS
2. **Replicate data** using AWS DMS (Database Migration Service)
3. **Switch over** when ready
4. **Delete old RDS** instance

## Cost Comparison

### Current (RDS t3.micro - Free Tier)
- **Cost**: $0/month (Free Tier)
- **Scaling**: Manual (stop/start, resize instance)
- **Performance**: Good for dev, limited for production

### After Upgrade (Aurora Serverless v2)
- **Cost**: ~$44/month minimum (0.5 ACU)
- **Scaling**: Automatic (0.5-16 ACU)
- **Performance**: Excellent, auto-scales with load

## When to Upgrade

**Upgrade when:**
- ✅ You have paying customers
- ✅ You need auto-scaling
- ✅ You want better performance
- ✅ You're ready to pay ~$44+/month

**Stay on RDS when:**
- ✅ Still in development
- ✅ No real users yet
- ✅ Want to minimize costs
- ✅ Free Tier is sufficient

## Benefits of Waiting

1. **Save money** during development
2. **Test everything** on free tier first
3. **Upgrade when needed** - migration is easy
4. **No code changes** required

## Summary

✅ **Easy to switch** - infrastructure code already supports both  
✅ **No code changes** - Prisma works with both  
✅ **Simple migration** - snapshot and restore  
✅ **Flexible** - upgrade when you're ready  

The current setup is perfect for development. When you're ready to scale, the migration is straightforward!

