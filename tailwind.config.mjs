/** @type {import('tailwindcss').Config} */
import daisyui from 'daisyui';

export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6', // blue-500
        secondary: '#6b7280', // gray-500
        accent: '#f59e0b', // amber-500
        neutral: '#111827', // gray-900
        'base-100': '#ffffff',
        info: '#3abff8',
        success: '#36d399',
        warning: '#fbbd23',
        error: '#f87272',
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: ['light'],
  },
}; 