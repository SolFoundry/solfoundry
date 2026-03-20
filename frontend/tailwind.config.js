/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: { extend: { colors: {
    brand: { 400: '#a855f7', 500: '#9945FF', 600: '#7c3aed' },
    surface: { DEFAULT: '#0a0a0a', 50: '#111', 100: '#1a1a1a', 200: '#222' },
  } } },
};
