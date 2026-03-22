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
        /** Google Stitch / Material-style palette — scoped to shared planner shell */
        share: {
          bg: '#111316',
          onBg: '#e2e2e6',
          primary: '#00daf3',
          onPrimary: '#00363d',
          primaryContainer: '#00b6cb',
          onSurface: '#e2e2e6',
          onSurfaceVariant: '#bcc9ce',
          surfaceContainer: '#1e2023',
          surfaceContainerHigh: '#282a2d',
          surfaceContainerHighest: '#333538',
          surfaceContainerLow: '#1a1c1f',
          outlineVariant: '#3d494d',
          secondary: '#a1cddd',
          tertiary: '#ffb77d',
        },
      },
      fontFamily: {
        sans: ['system-ui', 'ui-sans-serif', 'Inter', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
        shareHeadline: ['Epilogue', 'system-ui', 'sans-serif'],
        shareSans: ['Manrope', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
