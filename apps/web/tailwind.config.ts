import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0A1F44",
        gold: "#C9A24B",
      },
      fontFamily: {
        tahoma: ["Tahoma", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
