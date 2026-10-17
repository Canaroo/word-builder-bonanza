/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './data/**/*.{ts,tsx}',
    './ui/**/*.{ts,tsx}',
  ],
  // Built at runtime in GameScreenView: `grid-cols-${BUILD_ROW_SIZE}`
  safelist: ['grid-cols-8'],
  theme: {
    extend: {},
  },
  plugins: [],
};
