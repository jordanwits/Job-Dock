# Bastion Host Setup Complete! ✅

## Bastion Host Details

- **Instance ID**: `i-07e20f75096456dd9`
- **Public IP**: `98.84.121.11`
- **Instance Type**: t3.micro (Free Tier eligible)
- **SSH Key**: `jobdock-bastion.pem` (saved in project root)
- **Security**: Only accessible from your IP (47.32.166.63)

## Connect and Run Migrations

### Step 1: Fix Key Permissions (Windows)

The SSH key needs proper permissions. In PowerShell:

```powershell
# Remove inheritance and grant only your user access
icacls .\jobdock-bastion.pem /inheritance:r
icacls .\jobdock-bastion.pem /grant:r "$($env:USERNAME):(R)"
```

### Step 2: Connect via SSH

```powershell
ssh -i jobdock-bastion.pem ec2-user@98.84.121.11
```

**First time connecting**: Type `yes` when asked about the host fingerprint.

### Step 3: Install Node.js on Bastion

Once connected to the bastion host:

```bash
# Install Node.js 20 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Verify installation
node --version  # Should show v20.x.x
npm --version
```

### Step 4: Set Up Project Files

```bash
# Create project directory
mkdir -p ~/jobdock/backend
cd ~/jobdock/backend

# Install Prisma CLI
npm init -y
npm install prisma@latest @prisma/client@latest

# Create prisma directory
mkdir -p prisma/migrations/202412030001_init
```

### Step 5: Copy Database Credentials

Get the database password:

```bash
# Get password from Secrets Manager
DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id jobdock-db-credentials-dev \
  --query SecretString \
  --output text \
  --region us-east-1 | grep -o '"password":"[^"]*"' | cut -d'"' -f4)

echo "Database password retrieved"
```

### Step 6: Create Database URL

```bash
# Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://dbadmin:$DB_PASSWORD@jobdockstack-dev-databaseb269d8bb-b8ugmpllic6b.c4pys8gu6bf4.us-east-1.rds.amazonaws.com:5432/jobdock?schema=public"

echo "DATABASE_URL configured"
```

### Step 7: Create Prisma Schema

Create the schema file:

```bash
cat > prisma/schema.prisma << 'EOF'
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Tenant {
  id        String    @id @default(uuid())
  name      String
  subdomain String    @unique
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  contacts  Contact[]
  invoices  Invoice[]
  jobs      Job[]
  quotes    Quote[]
  services  Service[]
  users     User[]

  @@index([subdomain])
  @@map("tenants")
}

model User {
  id        String   @id @default(uuid())
  cognitoId String   @unique
  email     String
  name      String
  tenantId  String
  role      String   @default("user")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([cognitoId])
  @@index([email])
  @@map("users")
}

model Contact {
  id        String    @id @default(uuid())
  tenantId  String
  firstName String
  lastName  String
  email     String?
  phone     String?
  company   String?
  jobTitle  String?
  address   String?
  city      String?
  state     String?
  zipCode   String?
  country   String    @default("USA")
  tags      String[]  @default([])
  notes     String?
  status    String    @default("active")
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  tenant    Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  invoices  Invoice[]
  jobs      Job[]
  quotes    Quote[]

  @@index([tenantId])
  @@index([email])
  @@index([status])
  @@map("contacts")
}

model Quote {
  id          String          @id @default(uuid())
  tenantId    String
  quoteNumber String
  contactId   String
  subtotal    Decimal         @db.Decimal(10, 2)
  taxRate     Decimal         @default(0) @db.Decimal(5, 4)
  taxAmount   Decimal         @db.Decimal(10, 2)
  discount    Decimal         @default(0) @db.Decimal(10, 2)
  total       Decimal         @db.Decimal(10, 2)
  status      String          @default("draft")
  notes       String?
  validUntil  DateTime?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  lineItems   QuoteLineItem[]
  contact     Contact         @relation(fields: [contactId], references: [id])
  tenant      Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([contactId])
  @@index([status])
  @@index([quoteNumber])
  @@map("quotes")
}

model QuoteLineItem {
  id          String   @id @default(uuid())
  quoteId     String
  description String
  quantity    Decimal  @db.Decimal(10, 2)
  unitPrice   Decimal  @db.Decimal(10, 2)
  total       Decimal  @db.Decimal(10, 2)
  createdAt   DateTime @default(now())
  quote       Quote    @relation(fields: [quoteId], references: [id], onDelete: Cascade)

  @@index([quoteId])
  @@map("quote_line_items")
}

model Invoice {
  id            String            @id @default(uuid())
  tenantId      String
  invoiceNumber String
  contactId     String
  subtotal      Decimal           @db.Decimal(10, 2)
  taxRate       Decimal           @default(0) @db.Decimal(5, 4)
  taxAmount     Decimal           @db.Decimal(10, 2)
  discount      Decimal           @default(0) @db.Decimal(10, 2)
  total         Decimal           @db.Decimal(10, 2)
  status        String            @default("draft")
  paymentStatus String            @default("pending")
  notes         String?
  dueDate       DateTime?
  paymentTerms  String            @default("Net 30")
  paidAmount    Decimal           @default(0) @db.Decimal(10, 2)
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
  lineItems     InvoiceLineItem[]
  contact       Contact           @relation(fields: [contactId], references: [id])
  tenant        Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  payments      Payment[]

  @@index([tenantId])
  @@index([contactId])
  @@index([status])
  @@index([paymentStatus])
  @@index([invoiceNumber])
  @@map("invoices")
}

model InvoiceLineItem {
  id          String   @id @default(uuid())
  invoiceId   String
  description String
  quantity    Decimal  @db.Decimal(10, 2)
  unitPrice   Decimal  @db.Decimal(10, 2)
  total       Decimal  @db.Decimal(10, 2)
  createdAt   DateTime @default(now())
  invoice     Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId])
  @@map("invoice_line_items")
}

model Payment {
  id          String   @id @default(uuid())
  tenantId    String
  invoiceId   String
  amount      Decimal  @db.Decimal(10, 2)
  paymentDate DateTime @default(now())
  method      String
  reference   String?
  notes       String?
  createdAt   DateTime @default(now())
  invoice     Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([invoiceId])
  @@index([paymentDate])
  @@map("payments")
}

model Service {
  id              String   @id @default(uuid())
  tenantId        String
  name            String
  description     String?
  duration        Int
  price           Decimal  @db.Decimal(10, 2)
  isActive        Boolean  @default(true)
  availability    Json?
  bookingSettings Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  jobs            Job[]
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([isActive])
  @@map("services")
}

model Job {
  id          String   @id @default(uuid())
  tenantId    String
  title       String
  description String?
  contactId   String
  serviceId   String?
  startTime   DateTime
  endTime     DateTime
  status      String   @default("scheduled")
  location    String?
  notes       String?
  assignedTo  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  contact     Contact  @relation(fields: [contactId], references: [id])
  service     Service? @relation(fields: [serviceId], references: [id])
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([contactId])
  @@index([serviceId])
  @@index([startTime])
  @@index([status])
  @@map("jobs")
}

model Document {
  id         String   @id @default(uuid())
  tenantId   String
  fileName   String
  fileKey    String
  fileSize   Int
  mimeType   String
  entityType String
  entityId   String
  uploadedBy String
  createdAt  DateTime @default(now())

  @@index([tenantId])
  @@index([entityType, entityId])
  @@map("documents")
}
EOF
```

### Step 8: Copy Migration SQL

Copy the migration file:

```bash
cat > prisma/migrations/202412030001_init/migration.sql << 'EOF'
-- (Copy the entire contents from your local backend/prisma/migrations/202412030001_init/migration.sql)
-- For speed, I'll provide the key CREATE TABLE statements here
EOF
```

**Note**: You'll need to copy the migration.sql file from your local project. You can either:
1. SCP it: `scp -i jobdock-bastion.pem backend/prisma/migrations/202412030001_init/migration.sql ec2-user@98.84.121.11:~/jobdock/backend/prisma/migrations/202412030001_init/`
2. Or paste the contents manually

### Step 9: Run Migrations! 🚀

```bash
cd ~/jobdock/backend

# Generate Prisma client
npx prisma generate

# Deploy migrations
npx prisma migrate deploy
```

You should see:
```
✅ All migrations have been successfully applied
```

### Step 10: Verify Tables Created

```bash
# List all tables
npx prisma db execute --stdin << 'EOF'
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
EOF
```

You should see all your tables:
- tenants
- users
- contacts
- quotes
- quote_line_items
- invoices
- invoice_line_items
- payments
- services
- jobs
- documents

### Step 11: (Optional) Seed Initial Data

If you have a seed script:

```bash
# Install dependencies for seed script
npm install @prisma/client

# Run seed
npx prisma db seed
```

## Done! 🎉

Your database is now ready with all tables created!

## Clean Up When Done

After migrations are complete, you can:

1. **Keep the bastion running** if you need to run more migrations or access the database later
2. **Stop the instance** to save costs (you can restart it when needed):
   ```bash
   aws ec2 stop-instances --instance-ids i-07e20f75096456dd9 --region us-east-1
   ```
3. **Terminate the instance** if you're done (you can recreate it anytime):
   ```bash
   aws ec2 terminate-instances --instance-ids i-07e20f75096456dd9 --region us-east-1
   ```

## Troubleshooting

### Can't connect via SSH
- Wait 30 seconds after launch for SSH to be available
- Verify key permissions (see Step 1)
- Check your IP hasn't changed

### Database connection fails
- Verify DATABASE_URL is correct
- Check security groups allow bastion → database connection
- Ensure RDS instance is "available" status

### Migration fails
- Check DATABASE_URL format
- Verify Prisma schema syntax
- Look for SQL errors in migration file

## Next Steps

Once migrations are complete:
1. Test creating data in your app (contacts, quotes, invoices, jobs)
2. Verify data appears in the database
3. Move on to production deployment!

---

**Need help?** Check the error messages or let me know what step you're stuck on!

