export default { 
  content: ['./src/**/*.{ts,tsx}'], 
  darkMode: 'class', 
  theme: { 
    extend: { 
      colors: { 
        solana: { green: '#14F195', purple: '#9945FF' }, 
        surface: { DEFAULT: '#0a0a0a', 50: '#111', 100: '#1a1a1a', 200: '#222', 300: '#2a2a2a' },
        accent: { green: '#22c55e', blue: '#3b82f6', gold: '#fbbf24' }
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
        'feed-in': 'feed-in 0.3s ease-out forwards',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'feed-in': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    } 
  } 
};