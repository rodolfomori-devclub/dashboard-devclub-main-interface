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
        // Primary (Green) - DS tokens
        primary: {
          DEFAULT: '#22c55e',
          dark: '#16a34a',
          light: '#34d399',
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Accent (Purple) - DS tokens
        accent: {
          DEFAULT: '#7c3aed',
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#7c3aed',
          600: '#6d28d9',
          700: '#5b21b6',
          800: '#4c1d95',
        },
        // Secondary (Dark) - keep backward compat
        secondary: {
          DEFAULT: '#051626',
          dark: '#020A13',
          light: '#0A2E4D',
        },
        // Neutral (Zinc) - DS tokens
        surface: {
          DEFAULT: '#fafafa',
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        },
        // Dark mode surfaces
        card: {
          DEFAULT: '#ffffff',
          dark: '#141419',
        },
        'surface-secondary': {
          DEFAULT: '#f4f4f5',
          dark: '#1e1e24',
        },
        // Background
        background: {
          light: '#fafafa',
          dark: '#09090b',
        },
        // Text
        text: {
          light: '#18181b',
          dark: '#fafafa',
          muted: {
            light: '#71717a',
            dark: '#a1a1aa',
          },
        },
        // Semantic
        success: '#22c55e',
        info: '#3b82f6',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
      borderRadius: {
        'ds-sm': '8px',
        'ds-md': '10px',
        'ds': '12px',
        'ds-xl': '16px',
        'ds-2xl': '20px',
      },
      boxShadow: {
        'ds-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'ds-md': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        'ds-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        'neon': '0 0 5px theme(colors.primary.DEFAULT), 0 0 20px theme(colors.primary.DEFAULT)',
        'neon-lg': '0 0 10px theme(colors.primary.DEFAULT), 0 0 30px theme(colors.primary.DEFAULT)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.5s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(34, 197, 94, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(34, 197, 94, 0.9), 0 0 30px rgba(34, 197, 94, 0.3)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
  },
  plugins: [],
}
