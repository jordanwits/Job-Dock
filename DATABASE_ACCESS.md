# Accessing the Private RDS Database

## Overview

Your RDS database is in a private subnet (for security), which means it can't be accessed directly from the internet. This is the recommended production setup.

## Current Status

- ✅ AWS infrastructure deployed (RDS, VPC, security groups)
- ✅ Environment variables synced
- ⚠️ Database migrations need to be run from within the VPC

## Options for Running Migrations

### Option 1: AWS Systems Manager Session Manager (Recommended)

1. Launch an EC2 instance in the same VPC as your RDS
2. Install Session Manager agent
3. Connect via Session Manager (no SSH keys needed)
4. Run Prisma migrations from the EC2 instance

### Option 2: Bastion Host

1. Create a small EC2 instance (t2.micro) in the public subnet
2. SSH into the bastion host
3. From there, connect to the RDS instance
4. Run migrations

### Option 3: SSH Tunnel

1. Set up a bastion host (as above)
2. Create an SSH tunnel from your local machine:
   ```bash
   ssh -i your-key.pem -L 5432:YOUR-RDS-ENDPOINT:5432 ec2-user@YOUR-BASTION-IP
   ```
3. Then run migrations locally pointing to `localhost:5432`

### Option 4: Lambda Function for Migrations

Create a Lambda function that runs migrations on deployment. Example in `backend/src/functions/migrate.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

export async function handler() {
  const prisma = new PrismaClient();
  try {
    // Prisma migrate deploy logic here
    console.log('Migrations completed');
    return { statusCode: 200, body: 'OK' };
  } finally {
    await prisma.$disconnect();
  }
}
```

## Quick Setup for Development

### Create a Bastion Host (One-time setup)

1. In AWS Console → EC2 → Launch Instance
2. Choose Amazon Linux 2
3. Instance type: t2.micro (free tier)
4. Network: Select your JobDock VPC
5. Subnet: Select a PUBLIC subnet
6. Auto-assign Public IP: Enable
7. Security group: Allow SSH (port 22) from your IP
8. Launch and download the key pair

### Connect and Run Migrations

```bash
# SSH into bastion
ssh -i bastion-key.pem ec2-user@BASTION-PUBLIC-IP

# Install Node.js and dependencies
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18

# Clone your repo or copy migration files
# Set up DATABASE_URL environment variable
export DATABASE_URL="postgresql://dbadmin:PASSWORD@RDS-ENDPOINT:5432/jobdock?schema=public"

# Run migrations
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
```

## Security Notes

- ✅ RDS is NOT publicly accessible (good!)
- ✅ Security group only allows Lambda/VPC access
- ⚠️ Bastion host should have restricted SSH access (your IP only)
- ⚠️ Consider using Systems Manager instead of traditional SSH

## Current Database Connection Info

- **Endpoint**: `jobdockstack-dev-databaseb269d8bb-b8ugmpllic6b.c4pys8gu6bf4.us-east-1.rds.amazonaws.com`
- **Port**: 5432
- **Database**: jobdock
- **Username**: dbadmin
- **Password**: Stored in AWS Secrets Manager (`jobdock-db-credentials-dev`)

Get password:
```bash
aws secretsmanager get-secret-value \
  --secret-id jobdock-db-credentials-dev \
  --query SecretString \
  --output text \
  --region us-east-1
```

## Next Steps

1. Choose one of the access methods above
2. Run Prisma migrations: `npx prisma migrate deploy`
3. Optionally seed the database: `npx prisma db seed`
4. Verify with Prisma Studio (through tunnel): `npx prisma studio`

