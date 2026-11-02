/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      screens: {
        /**
         * Landscape phones: wide enough to look like a tablet but only ~390px
         * tall, so vertical chrome (headers, fixed tab bars) has to shrink.
         * `raw` keeps this a pure height query, independent of the width scale.
         */
        short: { raw: '(max-height: 500px)' },
        /** Devices whose primary input is a finger, not a cursor. */
        touch: { raw: '(pointer: coarse)' },
      },
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
          /** Artboard hairlines, tracks and chip fills (docs/design/mobile). */
          hairline: '#23262a',
          /** Tertiary text: resting tab labels, quiet meta. About 6.0:1 on surfaceContainerLow, 5.0:1 on the sheet surface. */
          onSurfaceDim: '#94a1a6',
          /** Control and state boundaries (checkbox and field outlines): at least 3:1 on surfaceContainerLow. */
          outlineStrong: '#6b7a7f',
          /** The one colour for every error message, always next to an icon. */
          error: '#ffb4ab',
          /** "Done": a stamp, a ticked Top 3 item, a full day. Always paired with a ✓ or a filled shape. */
          done: '#a1cddd',
          /** Ground of the fixed phone tab bar. */
          barBg: '#131518',
        },
      },
      fontFamily: {
        sans: ['system-ui', 'ui-sans-serif', 'Inter', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
        shareHeadline: ['Epilogue', 'system-ui', 'sans-serif'],
        shareSans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      spacing: {
        sidebar: '240px',
      },
      /**
       * The five type styles of the challenge screens (scout design review,
       * rule 9). rem, so they follow the reader's text size; nothing is
       * smaller than the 12px caption.
       */
      fontSize: {
        title: ['1.5rem', { lineHeight: '1.2', fontWeight: '800' }],
        section: ['1.0625rem', { lineHeight: '1.35', fontWeight: '600' }],
        body: ['0.9375rem', { lineHeight: '1.45' }],
        caption: ['0.75rem', { lineHeight: '1.35' }],
        numeral: ['2rem', { lineHeight: '1', fontWeight: '800' }],
      },
      // Default breakpoints are kept (md = 768px).
      // Custom scrollbar styles are in index.css.
    },
  },
  plugins: [],
}
