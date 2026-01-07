# JobDock - Contractor Management SAAS Platform

A comprehensive SAAS platform for contractors handling CRM, Quoting, Invoicing, and Scheduling.

## 🎨 Color Palette

- **Primary Dark**: `#0B132B` - Main background
- **Secondary Dark**: `#1C2541` - Cards/sections
- **Accent Blue**: `#3A506B` - Interactive elements
- **Gold**: `#D4AF37` - CTAs, highlights
- **Light**: `#F5F3F4` - Text on dark backgrounds

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn or pnpm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Development Commands

```bash
# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
```

## 📁 Project Structure

```
src/
├── components/     # Reusable UI components
├── features/       # Feature-based modules (CRM, Quotes, Invoices, Scheduling)
├── hooks/          # Custom React hooks
├── lib/            # Utility functions and configurations
├── types/          # TypeScript type definitions
├── utils/          # Helper functions
├── App.tsx         # Main app component
└── main.tsx        # Entry point
```

## 🏗️ Architecture

- **Frontend**: React 18 + TypeScript + Vite
- **State Management**: Zustand
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form + Zod
- **API Client**: Axios

## 📋 Roadmap

See [ROADMAP.md](./ROADMAP.md) for detailed development phases and milestones.

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
# Development (using mock data)
VITE_USE_MOCK_DATA=true
VITE_API_URL=http://localhost:8000

# Production (after AWS setup)
VITE_USE_MOCK_DATA=false
VITE_API_URL=https://your-api.execute-api.region.amazonaws.com/prod
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=your-pool-id
VITE_COGNITO_CLIENT_ID=your-client-id
VITE_S3_BUCKET=your-files-bucket
VITE_DEFAULT_TENANT_ID=demo-tenant
```

> Tip: the Vite dev server now follows `VITE_USE_MOCK_DATA`. Flip it to `false`
> any time you want your local build (or native mobile client) to hit the live
> AWS API instead of the in-browser mocks.
>
> Skip the copy/paste by running `npm run sync:aws:env -- --env=dev --region=us-east-1`
> after each CDK deploy. The script pulls CloudFormation outputs and writes both `.env`
> files automatically. See [LIVE_DATA_SETUP.md](./LIVE_DATA_SETUP.md) for details.

## ☁️ AWS Infrastructure Setup

**Ready to deploy?** See [AWS_SETUP_GUIDE.md](./AWS_SETUP_GUIDE.md) for step-by-step instructions.

### Quick Start

1. **Set up AWS Account** (you have this!)
2. **Deploy Infrastructure**:
   ```bash
   cd infrastructure
   npm install
   cdk bootstrap
   npm run deploy:dev
   ```
3. **Set up Database**:
   ```bash
   cd backend
   npm install
   npx prisma migrate deploy
   ```
4. **Connect Frontend**: Update `.env` with AWS values

### Architecture

- **Frontend**: React + Vite (hosted on S3 + CloudFront)
- **Backend**: AWS Lambda + API Gateway (serverless, auto-scales)
- **Database**: Aurora Serverless PostgreSQL (auto-scales 0.5-16 ACU)
- **Authentication**: AWS Cognito
- **File Storage**: S3
- **CDN**: CloudFront

## 🤖 AWS MCP Server (AI Debugging Assistant)

The AWS MCP (Model Context Protocol) server allows AI assistants to safely inspect and debug your JobDock AWS infrastructure with read-only access.

### Quick Setup

```bash
cd tools/aws-mcp
npm install
npm run build
```

Then configure your editor (Cursor/Claude Desktop) to use the MCP server. See **[MCP_AWS_SETUP.md](./MCP_AWS_SETUP.md)** for detailed instructions.

### What It Does

- 🔍 View Lambda logs for debugging
- 📊 Query DynamoDB tables
- 🗄️ List and read S3 objects
- 🔐 Inspect SSM parameters (masked)
- 🏗️ Check CloudFormation stack status
- ⚙️ View Lambda configurations

### Security

All operations are **read-only**. No deployments, writes, or deletions are possible. Sensitive values are automatically masked.

For full details, see [`tools/aws-mcp/README.md`](tools/aws-mcp/README.md).

### Scalability Features

✅ **Auto-scaling**: Lambda and Aurora Serverless scale automatically  
✅ **Multi-tenant**: Database-level tenant isolation  
✅ **High availability**: Multi-AZ deployment  
✅ **Cost-effective**: Pay only for what you use  
✅ **Production-ready**: Includes monitoring, logging, security

See [infrastructure/README.md](./infrastructure/README.md) for detailed architecture.

## 📚 Documentation

### Features
- [Public Booking Feature](./PUBLIC_BOOKING_FEATURE.md) - Calendly-style client booking system
- [Booking Confirmation & Emails](./BOOKING_CONFIRMATION_EMAILS.md) - Email notifications and approval workflow

### Setup & Deployment
- [Live Data Setup](./LIVE_DATA_SETUP.md) - Connect the app to AWS data sources
- [AWS Setup Guide](./AWS_SETUP_GUIDE.md) - Deploy AWS infrastructure
- [Architecture](./ARCHITECTURE.md) - System architecture overview
- [Development Strategy](./DEVELOPMENT_STRATEGY.md) - Development approach
- [Roadmap](./ROADMAP.md) - Feature roadmap
- [Backend README](./backend/README.md) - Backend API documentation
- [Infrastructure README](./infrastructure/README.md) - Infrastructure details

## 📝 License

Proprietary - All rights reserved

