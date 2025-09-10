/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./**/*.html",
    "./**/*.js",
    "!./node_modules/**/*"
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#0e2038',
        'brand-secondary': '#23325c',
        'brand-accent': '#1e3a8a',
      },
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      },
      animation: {
        'fadeIn': 'fadeIn 0.6s ease-out',
        'slideUp': 'slideUp 0.8s ease-out',
        'pulseGlow': 'pulseGlow 2s infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' }
        },
        slideUp: {
          'from': { opacity: '0', transform: 'translateY(30px)' },
          'to': { opacity: '1', transform: 'translateY(0)' }
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(14,32,56,0.1)' },
          '50%': { boxShadow: '0 0 30px rgba(14,32,56,0.2)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #0e2038 0%, #23325c 50%, #1e3a8a 100%)',
        'loading-shimmer': 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        'currency-badge': 'linear-gradient(135deg, #fbbf24, #f59e0b)',
      },
      backdropBlur: {
        'glass': '15px',
      },
      backgroundSize: {
        'shimmer': '200% 100%',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}