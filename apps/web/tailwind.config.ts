import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0A1F44",
        "navy-deep": "#071634",
        gold: "#C9A24B",
        "gold-light": "#E6C878",
        "gold-dark": "#A8842F",
      },
      fontFamily: {
        sans: ["Prompt", "Tahoma", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        glow: "0 10px 30px -12px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)",
        gold: "0 8px 22px -8px rgba(201,162,75,0.55)",
      },
      backgroundImage: {
        "gold-grad": "linear-gradient(135deg,#E6C878 0%,#C9A24B 55%,#A8842F 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
