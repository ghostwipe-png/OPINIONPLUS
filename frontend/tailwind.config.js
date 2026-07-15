/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#14171F',
          50: '#F4F5F7',
          100: '#E4E6EB',
          200: '#C3C7D1',
          400: '#6B7180',
          600: '#3A3F4D',
          800: '#1E212B',
          900: '#14171F',
        },
        paper: '#FBFAF7',
        signal: {
          DEFAULT: '#E0492B',
          50: '#FDECE8',
          100: '#FAD5CB',
          400: '#E86B4F',
          600: '#C93C20',
        },
        gold: '#C99A3B',
        wire: '#DAD5C8',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        widest2: '0.28em',
      },
      maxWidth: {
        prose2: '68ch',
      },
    },
  },
  plugins: [],
};
