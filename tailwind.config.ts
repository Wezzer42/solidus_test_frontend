import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080b0f",
        panel: "#101720",
        line: "#223040",
        flow: "#35e4a6",
        prime: "#ffb84d",
        steel: "#9fb0c4",
      },
      fontFamily: {
        display: ["var(--font-space)", "monospace"],
        body: ["var(--font-sans)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 80px rgba(53, 228, 166, 0.16)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
