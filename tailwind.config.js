/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    'bg-primary-lightBg',
    'bg-primary-dark',
    'border-primary-charcoal',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          dark: '#0B132B',
          'dark-secondary': '#1C2541',
          blue: '#3A506B',
          gold: '#D4AF37',
          light: '#F5F3F4',
          // Light mode colors
          lightBg: '#FAFAFA', // Soft white background
          lightSecondary: '#FFFFFF', // White for cards/sections
          lightText: '#1A1A1A', // Dark text for light mode
          lightTextSecondary: '#6B7280', // Secondary text for light mode
          charcoal: '#f3f4f6', // Light grey border for cards (gray-100)
        },
        // ── New semantic design system ──────────────────────────────
        // CSS-variable backed so a single token set switches with
        // [data-theme] (light default / dark). Pairs with the landing
        // page's teal brand. Roll out per-surface; legacy primary.* stays.
        canvas: 'var(--canvas)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          hover: 'var(--surface-hover)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          muted: 'var(--ink-muted)',
          subtle: 'var(--ink-subtle)',
        },
        line: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          strong: 'var(--accent-strong)',
          contrast: 'var(--accent-contrast)',
          soft: 'var(--accent-soft)',
        },
        success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)' },
        warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)' },
        danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)' },
        info: { DEFAULT: 'var(--info)', soft: 'var(--info-soft)' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Functional second voice: mono for numbers/metadata (tabular-nums)
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
    },
  },
  plugins: [],
}
