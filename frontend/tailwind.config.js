/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0a0d14',
          surface: '#111622',
          card: '#161d2d',
          border: '#1f293d',
          hover: '#242f45',
        },
        security: {
          critical: '#f43f5e', // rose-500
          high: '#f97316',     // orange-500
          medium: '#eab308',   // yellow-500
          low: '#06b6d4',      // cyan-500
          safe: '#10b981',     // emerald-500
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
