import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        river: {
          navy: "#0B1F3A",
          deep: "#0E2A52",
          blue: "#1552CC",
          primary: "#1D63E8",
          light: "#4C8DFF",
          sky: "#E8F0FE",
          mist: "#F4F8FF",
          ice: "#FAFBFF",
          success: "#12A16B",
          warn: "#E8A400",
          danger: "#E14B4B",
        },
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "'Times New Roman'", "serif"],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,31,58,0.04), 0 8px 24px rgba(11,31,58,0.06)",
        pop: "0 12px 32px rgba(21,82,204,0.16)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
