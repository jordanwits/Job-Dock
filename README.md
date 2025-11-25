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
VITE_API_URL=http://localhost:8000
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=your-pool-id
VITE_COGNITO_CLIENT_ID=your-client-id
```

## 📝 License

Proprietary - All rights reserved

