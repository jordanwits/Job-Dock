# Quick Start Guide

## 🚀 Getting Started

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Set Up Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:
- `VITE_API_URL`: Your backend API URL
- AWS credentials (when ready)

### Step 3: Start Development Server

```bash
npm run dev
```

The app will open at `http://localhost:3000`

## 📋 What's Been Set Up

### ✅ Project Foundation
- React 18 + TypeScript + Vite
- Tailwind CSS with your custom color palette
- ESLint + Prettier for code quality
- Path aliases configured (`@/` for `src/`)

### ✅ Project Structure
- Feature-based architecture ready
- Component library structure
- Type definitions setup
- API client configured

### ✅ Design System
- Color palette integrated
- Base components (Button, Card)
- Utility functions (cn for class merging)
- Custom scrollbar styles

### ✅ Developer Experience
- VS Code settings and extensions
- Hot module replacement
- TypeScript strict mode
- Code formatting on save

## 🎨 Color Palette Usage

The colors are available in Tailwind classes:

```tsx
// Background colors
bg-primary-dark          // #0B132B
bg-primary-dark-secondary // #1C2541
bg-primary-blue          // #3A506B
bg-primary-gold          // #D4AF37
bg-primary-light         // #F5F3F4

// Text colors
text-primary-dark
text-primary-light
text-primary-gold
text-primary-blue
```

## 📁 Next Steps

1. **Review the Roadmap**: Check `ROADMAP.md` for the full development plan
2. **Set Up AWS**: Follow Phase 1.2 in the roadmap for AWS infrastructure
3. **Build Authentication**: Start with Phase 2 for user authentication
4. **Create First Feature**: Begin with CRM (Phase 3) as your first feature

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier
- `npm run type-check` - Type check without emitting

## 📚 Key Files

- `ROADMAP.md` - Complete development roadmap
- `ARCHITECTURE.md` - Architecture and design decisions
- `package.json` - Dependencies and scripts
- `tailwind.config.js` - Tailwind configuration with colors
- `tsconfig.json` - TypeScript configuration

## 🔧 Development Tips

1. **Use Path Aliases**: Import with `@/components/...` instead of relative paths
2. **Component Structure**: Follow the feature-based architecture
3. **Type Safety**: Leverage TypeScript for type safety
4. **Styling**: Use Tailwind utility classes, extend in `tailwind.config.js` if needed
5. **State Management**: Use Zustand for feature stores

## 🐛 Troubleshooting

### Port Already in Use
Change the port in `vite.config.ts`:
```ts
server: {
  port: 3001, // Change to available port
}
```

### Type Errors
Run type checking:
```bash
npm run type-check
```

### Linting Errors
Auto-fix where possible:
```bash
npm run lint:fix
```

## 📖 Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Vite Guide](https://vitejs.dev/guide/)
- [React Router](https://reactrouter.com/)

---

**Ready to build!** 🎉

Start by reviewing the roadmap and begin implementing Phase 1.2 (AWS Infrastructure) or Phase 2 (Authentication) based on your priorities.

