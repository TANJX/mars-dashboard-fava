/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bank-amex': '#0000ff',
        'bank-bofa': '#cc0100',
        'bank-apple': '#434343',
        'bank-discover': '#ff6d01',
        'bank-citi': '#1255cc',
        'bank-chase': '#1255cc',
      }
    },
  },
  plugins: [],
}
