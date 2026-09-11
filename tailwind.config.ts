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
          canvas: "#EBEFF7",
          line: "#E7EAF3",
          accent: "#1554F0",
          accentDeep: "#0D3FC4",
          accentSoft: "#EAF0FE",
          good: "#15804E",
          goodSoft: "#E7F6EE",
          goodLine: "#BFE6D2",
          bad: "#D23C50",
          badSoft: "#FCEAEE",
          badLine: "#F5C9D2",
          warn: "#A9760D",
          warnSoft: "#FBF1DC",
          warnLine: "#EFDCA8",
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
