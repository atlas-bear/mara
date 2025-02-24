/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../shared/**/*.{js,ts,jsx,tsx}", // Include shared components
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
