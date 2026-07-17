/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        surface: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          600: '#475569',
          700: '#334155',
          750: '#293548',
          800: '#1e293b',
          850: '#172033',
          900: '#0f172a',
          950: '#020817',
        },
        accent: {
          purple: '#a855f7',
          blue:   '#3b82f6',
          cyan:   '#06b6d4',
          orange: '#f97316',
          pink:   '#ec4899',
        },
      },
      animation: {
        'fade-in':   'fadeIn 0.5s ease-in-out',
        'slide-up':  'slideUp 0.4s ease-out',
        'slide-in':  'slideIn 0.3s ease-out',
        'pulse-slow':'pulse 3s ease-in-out infinite',
        'bounce-in': 'bounceIn 0.6s ease-out',
        'glow':      'glow 2s ease-in-out infinite alternate',
        'shimmer':   'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn:   { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:  { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideIn:  { '0%': { opacity: '0', transform: 'translateX(-20px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        bounceIn: {
          '0%':   { opacity: '0', transform: 'scale(0.3)' },
          '50%':  { opacity: '1', transform: 'scale(1.05)' },
          '70%':  { transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glow: {
          '0%':   { boxShadow: '0 0 5px rgba(34,197,94,0.4)' },
          '100%': { boxShadow: '0 0 20px rgba(34,197,94,0.8), 0 0 40px rgba(34,197,94,0.4)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backdropBlur: { xs: '2px' },
      boxShadow: {
        'glow-green':  '0 0 20px rgba(34,197,94,0.4)',
        'glow-blue':   '0 0 20px rgba(59,130,246,0.4)',
        'glow-purple': '0 0 20px rgba(168,85,247,0.4)',
        'card':        '0 4px 24px rgba(0,0,0,0.12)',
        'card-dark':   '0 4px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
