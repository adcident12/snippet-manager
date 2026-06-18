/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'Noto Sans Thai', 'sans-serif'],
      },
      colors: {
        // Dark theme palette (natural, not AI-generated)
        'surface': '#1a1d23',
        'surface-elevated': '#242830',
        'border': '#2e333b',
        'border-hover': '#3e4451',
        'text-primary': '#e2e6ea',
        'text-secondary': '#9ca3af',
        'text-muted': '#6b7280',
        'accent': '#6d9fff',
        'accent-hover': '#8aa8ff',
        'success': '#4ade80',
        'warning': '#facc15',
        'danger': '#f87171',
      },
    },
  },
  plugins: [],
}