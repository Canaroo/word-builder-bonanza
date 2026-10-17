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
  theme: {
    extend: {
      // Arcade + VHS design tokens. Use these instead of raw hex values in components.
      colors: {
        neon: {
          cyan: '#22e4ff',
          pink: '#ff3ea5',
          yellow: '#ffd23f',
          green: '#3dff8c',
          purple: '#b45cff',
          orange: '#ff8a2a',
          red: '#ff4757',
        },
        crt: {
          950: '#06050d',
          900: '#0c0a1d',
          800: '#151233',
          700: '#211c4a',
          600: '#2f2866',
        },
      },
      fontFamily: {
        display: ['Bungee', 'Poppins', 'sans-serif'], // marquee titles, buttons
        osd: ['VT323', 'Roboto Mono', 'monospace'], // VCR on-screen display: HUD numbers, labels
      },
      boxShadow: {
        'glow-cyan': '0 0 6px #22e4ff, 0 0 18px rgba(34, 228, 255, 0.45)',
        'glow-pink': '0 0 6px #ff3ea5, 0 0 18px rgba(255, 62, 165, 0.45)',
        'glow-yellow': '0 0 6px #ffd23f, 0 0 18px rgba(255, 210, 63, 0.45)',
      },
      dropShadow: {
        'glow-cyan': ['0 0 2px #22e4ff', '0 0 10px rgba(34, 228, 255, 0.7)'],
        'glow-pink': ['0 0 2px #ff3ea5', '0 0 10px rgba(255, 62, 165, 0.7)'],
        'glow-yellow': ['0 0 2px #ffd23f', '0 0 10px rgba(255, 210, 63, 0.7)'],
      },
    },
  },
  plugins: [],
};
