# Migration Deployment Instructions: Multiple Team Member Assignment

## Migration Created ✅

The migration file has been created at:
`backend/prisma/migrations/20260217000000_change_assigned_to_to_json_array/migration.sql`

This migration will:
1. Remove foreign key constraints (not compatible with JSONB arrays)
2. Remove old indexes
3. Convert existing single user IDs to JSON arrays: `"user-id"` → `["user-id"]`
4. Change column types from TEXT to JSONB for both `jobs` and `job_logs` tables

## Deployment Options

### Option 1: Via Bastion Host (Recommended)

If you have a bastion host set up:

```powershell
# 1. Copy migration file to bastion
scp -i jobdock-bastion.pem backend/prisma/migrations/20260217000000_change_assigned_to_to_json_array/migration.sql ec2-user@<bastion-ip>:~/

# 2. Connect to bastion
ssh -i jobdock-bastion.pem ec2-user@<bastion-ip>

# 3. Set up DATABASE_URL
export DATABASE_URL="postgresql://dbadmin:<password>@<rds-host>:5432/jobdock?schema=public"

# 4. Run migration
cd ~/jobdock/backend  # or wherever your backend code is
npx prisma migrate deploy
```

### Option 2: Via AWS RDS Query Editor

1. Go to AWS Console → RDS → Query Editor
2. Connect to your database
3. Copy and paste the SQL from `backend/prisma/migrations/20260217000000_change_assigned_to_to_json_array/migration.sql`
4. Execute the SQL

### Option 3: Via Lambda Migration Handler

If you have the migrate Lambda function deployed, you can trigger it to run migrations. However, this requires the Lambda to have the migration files bundled.

### Option 4: Use the PowerShell Script (When Database is Accessible)

The script `deploy-assigned-to-migration-prisma.ps1` has been created. It will work once you have network access to the database (via VPN, bastion, or if the database is made publicly accessible temporarily).

## What Happens After Migration

Once the migration is deployed:

✅ **Backend Changes:**
- `assignedTo` fields now store JSON arrays: `["user-id-1", "user-id-2"]`
- Backend functions handle both single strings and arrays (backward compatible)
- Assignment notifications sent to all assigned team members

✅ **Frontend Changes:**
- MultiSelect component allows selecting multiple team members
- Forms show selected members as removable chips
- Display components show comma-separated names: "John Doe, Jane Smith"

## Testing Checklist

After deployment, test:

1. ✅ Create a new job/appointment with multiple team members
2. ✅ Edit an existing job/appointment and add/remove team members  
3. ✅ Verify multiple names display correctly in job details
4. ✅ Check that assignment notifications are sent to all assignees
5. ✅ Verify backward compatibility with existing single-assignment data

## Rollback (If Needed)

If you need to rollback, you would need to:
1. Convert JSON arrays back to single strings (take first element)
2. Change column types back to TEXT
3. Re-add foreign key constraints

However, this migration is designed to be safe and maintain backward compatibility.
