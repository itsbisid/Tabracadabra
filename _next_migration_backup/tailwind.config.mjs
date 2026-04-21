/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0F2B5B",
          light: "#1A3E7A",
          dark: "#091D3E",
          hover: "#163573",
        },
        accent: {
          DEFAULT: "#00C9A7",
          light: "#33D4B8",
          dark: "#00A88C",
        },
      },
    },
  },
  plugins: [],
};
