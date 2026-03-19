import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fff4',
          100: '#dcffe8',
          200: '#b3ffc9',
          300: '#80ffa3',
          400: '#00ff88',
          500: '#00cc6a',
          600: '#00a354',
          700: '#008045',
          800: '#00663a',
          900: '#005432',
        },
      },
    },
  },
  plugins: [],
};

export default config;
