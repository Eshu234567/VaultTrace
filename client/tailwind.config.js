/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        vault: {
          navy: '#0B132B',
          slate: '#1C2541',
          teal: '#0D9488',
          accent: '#4F46E5',
          paper: '#F8FAFC',
        }
      }
    },
  },
  plugins: [],
};
