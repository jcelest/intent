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
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        accent: "var(--accent)",
        muted: "var(--muted)",
        border: "var(--border)",
        oled: "#000000",
        "slate-950": "#020617",
        "cyan-400": "#22d3ee",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        shimmer: "shimmer 3s linear infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(34, 211, 238, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(34, 211, 238, 0.6)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      boxShadow: {
        glow: "0 0 15px rgba(34, 211, 238, 0.5)",
        "glow-lg": "0 0 30px rgba(34, 211, 238, 0.4)",
      },
    },
  },
  plugins: [],
};
export default config;
