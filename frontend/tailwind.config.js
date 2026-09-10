/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        noc: {
          950: '#06090e',
          900: '#0b111a',
          850: '#0f1724',
          800: '#151f30',
          700: '#1e2b40',
          600: '#2b3d5b',
          border: '#1e293b',
          panel: '#0d131f',
        },
        status: {
          up: '#10b981',
          down: '#ef4444',
          warning: '#f59e0b',
          info: '#3b82f6',
          muted: '#64748b',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'critical-pulse': 'criticalPulse 1.5s ease-in-out infinite',
      },
      keyframes: {
        criticalPulse: {
          '0%, 100%': { opacity: 1, boxShadow: '0 0 15px rgba(239, 68, 68, 0.6)' },
          '50%': { opacity: 0.6, boxShadow: '0 0 5px rgba(239, 68, 68, 0.2)' },
        }
      }
    },
  },
  plugins: [],
}
