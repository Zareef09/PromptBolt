/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './public/**/*',
    './*.{js,ts}',
    './vite.config.ts',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        display: ['Syne', 'Outfit', 'system-ui', 'sans-serif'],
      },
      colors: {
        bolt: {
          void: '#050506',
          ink: '#0c0c0e',
          card: '#121214',
          lime: '#bef264',
          pink: '#f472b6',
          fuchsia: '#e879f9',
          cyan: '#22d3ee',
          violet: '#a78bfa',
        },
      },
      boxShadow: {
        glow: '0 0 28px rgba(232, 121, 249, 0.35)',
        'glow-cyan': '0 0 24px rgba(34, 211, 238, 0.25)',
      },
    },
  },
  plugins: [],
}
