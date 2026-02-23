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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
