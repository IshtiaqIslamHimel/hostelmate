/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#4f46e5', hover: '#4338ca' }
      },
      borderRadius: { xl2: '1.1rem' }
    },
  },
  plugins: [],
}
