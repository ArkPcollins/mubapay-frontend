/** Design tokens live in CSS variables (src/index.css) so light/dark share one scale. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--ink) / <alpha-value>)',
        paper: 'rgb(var(--paper) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        palm: { DEFAULT: 'rgb(var(--palm) / <alpha-value>)', soft: 'rgb(var(--palm-soft) / <alpha-value>)', ink: 'rgb(var(--palm-ink) / <alpha-value>)' },
        kola: { DEFAULT: 'rgb(var(--kola) / <alpha-value>)', soft: 'rgb(var(--kola-soft) / <alpha-value>)' },
        danger: { DEFAULT: 'rgb(var(--danger) / <alpha-value>)', soft: 'rgb(var(--danger-soft) / <alpha-value>)' },
        warn: { DEFAULT: 'rgb(var(--warn) / <alpha-value>)', soft: 'rgb(var(--warn-soft) / <alpha-value>)' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['Figtree', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl: '14px', '2xl': '20px' },
    },
  },
  plugins: [],
};
