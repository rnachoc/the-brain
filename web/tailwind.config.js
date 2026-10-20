/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        hq: {
          bg: '#05070f',
          panel: '#0b1020',
          card: '#111830',
          line: '#1e2742',
        },
      },
    },
  },
  plugins: [],
}
