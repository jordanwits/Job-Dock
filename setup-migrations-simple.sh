#!/bin/bash
# Simple JobDock Database Migration Setup
# Uses Amazon Linux 2 native packages

set -e

echo "==================================="
echo "JobDock Database Migration Setup"
echo "==================================="
echo ""

# Update system and install Node.js from Amazon repos
echo "📦 Installing Node.js from Amazon Linux repos..."
sudo yum update -y
sudo yum install -y nodejs npm

echo ""
echo "✅ Node.js installed: $(node --version)"
echo "✅ NPM installed: $(npm --version)"
echo ""

# Create project structure
echo "📁 Creating project structure..."
mkdir -p ~/jobdock/backend/prisma/migrations/202412030001_init
cd ~/jobdock/backend

# Initialize package.json
cat > package.json << 'PACKAGE_EOF'
{
  "name": "jobdock-migrations",
  "version": "1.0.0"
}
PACKAGE_EOF

# Install Prisma
echo "📦 Installing Prisma..."
npm install prisma@latest @prisma/client@latest

# Get database credentials
echo ""
echo "🔐 Retrieving database credentials..."
DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id jobdock-db-credentials-dev \
  --query SecretString \
  --output text \
  --region us-east-1)

DB_PASSWORD=$(echo "$DB_SECRET" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['password'])")
DB_HOST=$(echo "$DB_SECRET" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['host'])")

export DATABASE_URL="postgresql://dbadmin:$DB_PASSWORD@$DB_HOST:5432/jobdock?schema=public"

echo "✅ Database credentials retrieved"
echo "✅ Database host: $DB_HOST"
echo ""

# Create Prisma schema
echo "📝 Creating Prisma schema..."
cat > prisma/schema.prisma << 'SCHEMA_EOF'
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-1.0.x"]
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
SCHEMA_EOF

echo "✅ Prisma schema created"
echo ""

# Create migration lock file
cat > prisma/migrations/migration_lock.toml << 'LOCK_EOF'
# Please do not edit this file manually
provider = "postgresql"
LOCK_EOF

# Generate Prisma client
echo "🔨 Generating Prisma client..."
npx prisma generate

echo ""
echo "🚀 Creating database tables..."
echo ""

# Use db push to create tables directly
npx prisma db push --accept-data-loss --skip-generate

echo ""
echo "========================================="
echo "✅ Database setup complete!"
echo "========================================="
echo ""
echo "📊 Verifying tables were created..."
npx prisma db execute --stdin <<< "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
echo ""
echo "✅ All done! Your database is ready."
echo ""

