import type { Config } from "tailwindcss";

const config: Config = {
  // Class-based dark mode — toggled by `useThemeStore` adding/removing
  // the `dark` class on <html>. System preference is the initial value
  // when no explicit preference is stored in localStorage.
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f0f3f9",
          100: "#d9e0f0",
          200: "#b3c1e1",
          300: "#8da2d2",
          400: "#6783c3",
          500: "#4164b4",
          600: "#345090",
          700: "#273c6c",
          800: "#1B3A6B",
          900: "#0d1424",
        },
        crimson: {
          50: "#fff0f1",
          100: "#ffe1e3",
          200: "#ffc7cc",
          300: "#ff9aa2",
          400: "#ff636f",
          500: "#ff2d3c",
          600: "#ed1120",
          700: "#c8102e",
          800: "#9f0c24",
          900: "#7d0b20",
          950: "#44030d",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
