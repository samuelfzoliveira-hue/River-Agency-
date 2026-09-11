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
          ink: "#12182B",
          ink2: "#5B6478",
          ink3: "#9AA2B4",
          paper: "#FFFFFF",
          paper2: "#F7F8FB",
          line: "#E7E9F0",
          accent: "#1554F0",
          accentDeep: "#0D3FC4",
          accentSoft: "#EEF2FE",
          success: "#1C8A5B",
          warn: "#B07F12",
          danger: "#D23C50",
        },
      },
      fontFamily: {
        sans: ["Manrope", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      maxWidth: {
        report: "640px",
      },
    },
  },
  plugins: [],
};

export default config;
