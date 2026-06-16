/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta de marca Mulata: elegante, femenina y cálida.
        mulata: {
          50: '#fdf6f1',
          100: '#f9e8e0',
          200: '#f1cdbf',
          300: '#e6a892',
          400: '#d67e63',
          500: '#c65d44',
          600: '#a8456b', // rosa vino principal
          700: '#8a3557',
          800: '#6f2a47',
          900: '#4d1d31',
        },
        cream: '#fdf6f1',
        ink: '#3b2d33',
      },
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 8px 30px -12px rgba(168, 69, 107, 0.25)',
        card: '0 4px 20px -8px rgba(59, 45, 51, 0.15)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        'slide-up': {
          '0%': { transform: 'translateY(16px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        'pop': {
          '0%': { transform: 'scale(0.96)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'pop': 'pop 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
