import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        meta: {
          green: "#00FF41",
          cyan: "#00D9FF",
          red: "#FF0051",
          gold: "#FFD700",
          bg: "#0a0a0f",
          "bg-light": "#12121a",
          "bg-card": "#1a1a24",
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', "cursive"],
      },
      animation: {
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-in": "slideIn 0.3s ease-out",
        "fade-in": "fadeIn 0.5s ease-out",
        "bounce-slow": "bounce 3s infinite",
        glow: "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        slideIn: {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px var(--tw-shadow-color)" },
          "100%": { boxShadow: "0 0 20px var(--tw-shadow-color)" },
        },
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(to right, rgba(0,255,65,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,255,65,0.03) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "20px 20px",
      },
    },
  },
  plugins: [],
};

export default config;
