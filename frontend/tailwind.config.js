/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        forge: {
          950: '#050505',
          900: '#0A0A0F',
          850: '#0F0F18',
          800: '#16161F',
          700: '#1E1E2A',
          600: '#2A2A3A',
        },
        border: {
          DEFAULT: '#1E1E2E',
          hover: '#2E2E42',
          active: '#3E3E56',
        },
        emerald: {
          DEFAULT: '#00E676',
          light: '#69F0AE',
          dim: 'rgba(0,230,118,0.7)',
          glow: 'rgba(0,230,118,0.15)',
          bg: 'rgba(0,230,118,0.08)',
          border: 'rgba(0,230,118,0.25)',
        },
        purple: {
          DEFAULT: '#7C3AED',
          light: '#A78BFA',
          dim: 'rgba(124,58,237,0.7)',
          glow: 'rgba(124,58,237,0.15)',
          bg: 'rgba(124,58,237,0.08)',
          border: 'rgba(124,58,237,0.25)',
        },
        magenta: {
          DEFAULT: '#E040FB',
          light: '#EA80FC',
          dim: 'rgba(224,64,251,0.7)',
          glow: 'rgba(224,64,251,0.15)',
          bg: 'rgba(224,64,251,0.08)',
          border: 'rgba(224,64,251,0.25)',
        },
        text: {
          primary: '#F0F0F5',
          secondary: '#A0A0B8',
          muted: '#5C5C78',
          inverse: '#050505',
        },
        status: {
          success: '#00E676',
          warning: '#FFB300',
          error: '#FF5252',
          info: '#40C4FF',
        },
        tier: {
          t1: '#00E676',
          t2: '#40C4FF',
          t3: '#7C3AED',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'grid-forge': `
          linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
        `,
        'gradient-navbar': 'linear-gradient(90deg, #00E676, #7C3AED, #E040FB)',
        'gradient-hero': 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.15) 0%, rgba(224,64,251,0.08) 40%, transparent 70%)',
        'gradient-card-glow': 'radial-gradient(ellipse at center, rgba(0,230,118,0.06), transparent 70%)',
        'gradient-footer': 'linear-gradient(90deg, #E040FB, #7C3AED, #00E676)',
      },
      backgroundSize: {
        'grid-forge': '40px 40px',
      },
      keyframes: {
        typewriter: {
          from: { width: '0' },
          to: { width: '100%' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'ember-float': {
          '0%': { opacity: '0', transform: 'translateY(0) scale(0.5)' },
          '30%': { opacity: '0.8' },
          '100%': { opacity: '0', transform: 'translateY(-80px) scale(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        'gradient-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },
      animation: {
        typewriter: 'typewriter 2.5s steps(44) 0.5s forwards',
        blink: 'blink 1s step-end infinite',
        ember: 'ember-float 3s ease-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 6s ease infinite',
      },
    },
  },
  plugins: [],
};
