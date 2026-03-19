/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff', 100: '#d9eaff', 200: '#bcdbff', 300: '#8ec5ff',
          400: '#59a4ff', 500: '#337dff', 600: '#1b5cf5', 700: '#1448e1',
          800: '#173ab6', 900: '#19358f', 950: '#142357',
        },
      },
    },
  },
  plugins: [],
};
