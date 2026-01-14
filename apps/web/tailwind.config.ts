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
        roman: {
          gold: "#D4AF37",
          "gold-light": "#F4D03F",
          purple: "#5B2C6F",
          "purple-light": "#7D3C98",
          marble: "#F5F5F0",
          "marble-dark": "#E8E4D9",
          crimson: "#8B0000",
          bronze: "#CD7F32",
          bg: "#F5E6D3",
          "bg-light": "#E8D5C4",
          "bg-card": "#FBF7F0",
          text: "#3D2B1F",
          stone: "#8B7355",
          terracotta: "#C46A4E",
          olive: "#5C5C3D",
        },
      },
      fontFamily: {
        serif: ["Cinzel", "Trajan Pro", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["0.875rem", { lineHeight: "1.25rem" }],
        sm: ["1rem", { lineHeight: "1.5rem" }],
        base: ["1.125rem", { lineHeight: "1.75rem" }],
        lg: ["1.25rem", { lineHeight: "1.75rem" }],
        xl: ["1.5rem", { lineHeight: "2rem" }],
        "2xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "3xl": ["2.25rem", { lineHeight: "2.5rem" }],
        "4xl": ["3rem", { lineHeight: "1" }],
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
          "linear-gradient(to right, rgba(139,115,85,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(139,115,85,0.08) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "20px 20px",
      },
    },
  },
  plugins: [],
};

export default config;
