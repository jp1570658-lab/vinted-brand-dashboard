import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0a0a0a',
        card: '#141414',
        edge: '#2a2a2a',
        gold: '#c9a84c',
        status: {
          sourced: '#3b82f6',
          transit: '#f59e0b',
          stock: '#22c55e',
          sold: '#9ca3af',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
