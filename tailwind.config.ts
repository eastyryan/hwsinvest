import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        hws: {
          purple: "#4B2E83", // primary brand
          orange: "#E87722", // accent / CTAs
          yellow: "#FFC72C", // sparing highlight
        },
        ink: "#0E1116", // page background
        panel: "#161B22", // cards / panels
        line: "#2A2F37", // borders
        up: "#16A34A", // gains
        down: "#DC2626", // losses
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        marquee: "marquee 40s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
