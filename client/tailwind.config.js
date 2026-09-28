/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sap: {
          blue: '#0070F2',
          dark: '#002B66',
          gold: '#E35205',
          amber: '#F58B00',
          navy: '#0A1C3F',
          surface: '#F5F7FA',
          light: '#EBF3FC',
          accent: '#1889F2',
          success: '#107E3E',
          danger: '#BB0000',
        }
      },
      fontFamily: {
        sans: ['"72"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      animation: {
        'bounce-short': 'bounce 0.8s ease-in-out 2',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pop-in': 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
      },
      keyframes: {
        popIn: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
