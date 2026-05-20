import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-dm-serif)", "Georgia", "ui-serif", "serif"],
      },
      colors: {
        reg: {
          bg: "#F5F3EE",
          white: "#FFFFFF",
          section: "#EDEAE2",
          border: "#DDD9D0",
          "border-soft": "#E8E4DC",
          navy: "#1C2B3A",
          "navy-mid": "#243447",
          "navy-light": "#2C4059",
          "navy-btn-from": "#1C3A5A",
          "navy-btn-to": "#0F1C2E",
          gold: "#B8851A",
          "gold-light": "#D4A030",
          "gold-muted": "#9A6F14",
          "gold-bg": "#FBF3E2",
          "text-main": "#1A2533",
          "text-sub": "#4A5F74",
          "text-muted": "#7A90A6",
        },
        navy: {
          600: "#253B57",
          700: "#1E3050",
          800: "#162236",
          900: "#0F1C2E",
          950: "#0a1220",
        },
        gold: {
          300: "#f0d070",
          400: "#E8B84B",
          500: "#C9972E",
          600: "#A07820",
          700: "#7a5a16",
          800: "#5a4012",
        },
        cream: {
          50: "#fdfcfa",
          100: "#F7F4EE",
          200: "#EDE8DF",
          300: "#E2DDD5",
          400: "#D5CFC4",
          500: "#C5BDB0",
        },
        // Keep crimson for any components not yet migrated
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
