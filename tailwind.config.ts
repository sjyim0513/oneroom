import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f4ef",
          100: "#ece8dc",
          200: "#d8d0bb",
          300: "#bcae94",
          400: "#9b8971",
          500: "#7e6d57",
          600: "#635446",
          700: "#4a4037",
          800: "#342e29",
          900: "#211d1a",
        },
        sand: {
          50: "#faf7f0",
          100: "#f2ecdd",
          200: "#e7dac0",
          300: "#d4bd93",
          400: "#c39f6b",
          500: "#ae8250",
          600: "#8a6540",
          700: "#6a4d33",
          800: "#4a3624",
          900: "#312219",
        },
        moss: {
          50: "#f4f6f1",
          100: "#e7ece0",
          200: "#d2dcc4",
          300: "#b0c398",
          400: "#89a26d",
          500: "#68824d",
          600: "#52673d",
          700: "#3d4f2f",
          800: "#2c3922",
          900: "#1d2517",
        },
        clay: {
          50: "#fcf5ef",
          100: "#f7e4d3",
          200: "#efc6a1",
          300: "#e39f6f",
          400: "#d97742",
          500: "#c75f2f",
          600: "#a54928",
          700: "#7f361f",
          800: "#592519",
          900: "#391711",
        },
      },
      boxShadow: {
        panel: "0 24px 60px rgba(26, 24, 20, 0.08)",
      },
      fontFamily: {
        body: [
          "var(--font-manrope)",
          "sans-serif",
        ],
        display: [
          "var(--font-space-grotesk)",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
