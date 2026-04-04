/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1D4ED8',
          accent: '#3B82F6',
        },
        canvas: '#F8FAFC',
        surface: '#FFFFFF',
        soft: '#F1F5F9',
        border: '#E2E8F0',
        ink: '#0F172A',
        secondary: '#475569',
        muted: '#94A3B8',
        success: '#16A34A',
        warning: '#F59E0B',
        danger: '#DC2626',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 4px 0 rgba(15,23,42,0.06), 0 1px 2px -1px rgba(15,23,42,0.04)',
        'card-hover': '0 8px 24px -4px rgba(15,23,42,0.10), 0 2px 6px -2px rgba(15,23,42,0.06)',
        'card-xl': '0 12px 40px -8px rgba(15,23,42,0.14), 0 4px 12px -4px rgba(15,23,42,0.08)',
        modal: '0 24px 72px -12px rgba(15,23,42,0.22), 0 8px 24px -6px rgba(15,23,42,0.10)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.35s ease-out',
        'pulse-ring': 'pulseRing 1.8s ease-out infinite',
        'count-up': 'countUp 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(1)', opacity: '0.8' },
          '70%': { transform: 'scale(1.15)', opacity: '0.2' },
          '100%': { transform: 'scale(1)', opacity: '0' },
        },
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
