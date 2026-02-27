/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#050509',
        surface: '#111827',
        surfaceAlt: '#020617',
        accent: '#38bdf8',
        accentSoft: '#0ea5e9',
        textPrimary: '#e5e7eb',
        textMuted: '#9ca3af',
        borderSubtle: '#1f2937',
      },
      fontFamily: {
        sans: ['system-ui', 'ui-sans-serif', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
