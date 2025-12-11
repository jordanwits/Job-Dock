# JobDock Backend API

Serverless backend using AWS Lambda and API Gateway.

## Architecture

- **Runtime**: Node.js 20.x
- **Framework**: AWS Lambda Functions
- **Database**: Aurora Serverless PostgreSQL (via Prisma)
- **Authentication**: AWS Cognito
- **File Storage**: S3

## Project Structure

```
backend/
├── src/
│   ├── functions/          # Lambda function handlers
│   │   ├── auth/
│   │   ├── contacts/
│   │   ├── quotes/
│   │   ├── invoices/
│   │   ├── jobs/
│   │   └── services/
│   ├── lib/                # Shared utilities
│   │   ├── db.ts          # Database client
│   │   ├── auth.ts        # Auth helpers
│   │   ├── middleware.ts # Request middleware
│   │   └── errors.ts      # Error handling
│   └── types/             # TypeScript types
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Database migrations
└── package.json
```

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in values from your AWS infrastructure:

```bash
cp .env.example .env
```

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

### 4. Deploy Lambda Functions

```bash
# Build
npm run build

# Deploy (using AWS SAM or CDK)
npm run deploy
```

## Development

### Local Development

```bash
# Run Prisma Studio (database GUI)
npx prisma studio

# Watch mode
npm run dev
```

### Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Multi-Tenant Architecture

All database queries automatically include `tenant_id` filtering via middleware.

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login
- `POST /auth/refresh` - Refresh token
- `POST /auth/logout` - Logout

### Contacts
- `GET /contacts` - List contacts
- `GET /contacts/:id` - Get contact
- `POST /contacts` - Create contact
- `PUT /contacts/:id` - Update contact
- `DELETE /contacts/:id` - Delete contact

### Quotes
- `GET /quotes` - List quotes
- `GET /quotes/:id` - Get quote
- `POST /quotes` - Create quote
- `PUT /quotes/:id` - Update quote
- `DELETE /quotes/:id` - Delete quote

### Invoices
- `GET /invoices` - List invoices
- `GET /invoices/:id` - Get invoice
- `POST /invoices` - Create invoice
- `PUT /invoices/:id` - Update invoice
- `DELETE /invoices/:id` - Delete invoice

### Jobs
- `GET /jobs` - List jobs
- `GET /jobs/:id` - Get job
- `POST /jobs` - Create job
- `PUT /jobs/:id` - Update job
- `DELETE /jobs/:id` - Delete job

### Services
- `GET /services` - List services
- `GET /services/:id` - Get service
- `POST /services` - Create service
- `PUT /services/:id` - Update service
- `DELETE /services/:id` - Delete service

## Environment Variables

Required environment variables (set in Lambda configuration):

- `DATABASE_SECRET_ARN` - ARN of database credentials secret
- `DATABASE_CLUSTER_ENDPOINT` - Database endpoint
- `DATABASE_NAME` - Database name
- `USER_POOL_ID` - Cognito User Pool ID
- `USER_POOL_CLIENT_ID` - Cognito User Pool Client ID
- `FILES_BUCKET` - S3 bucket for file storage
- `ENVIRONMENT` - Environment (dev/staging/prod)
- `DEFAULT_TENANT_ID` - Tenant ID to use when requests omit `X-Tenant-ID`

