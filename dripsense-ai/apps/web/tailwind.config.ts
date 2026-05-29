import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular"]
      },
      colors: {
        medical: {
          bg: "#F8F9FA",
          surface: "#FFFFFF",
          border: "#E5E7EB",
          muted: "#6B7280",
          blue: "#1D6FA4",
          "blue-light": "#EFF6FF",
          green: "#16A34A",
          "green-light": "#F0FDF4",
          amber: "#D97706",
          "amber-light": "#FFFBEB",
          orange: "#EA580C",
          red: "#DC2626",
          "red-light": "#FEF2F2",
          purple: "#7C3AED",
          gray: "#374151"
        }
      },
      keyframes: {
        criticalPulse: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(220,38,38,.22)" },
          "50%": { boxShadow: "0 0 0 8px rgba(220,38,38,0)" }
        },
        updateFlash: {
          "0%": { backgroundColor: "rgba(239,246,255,.95)" },
          "100%": { backgroundColor: "transparent" }
        }
      },
      animation: {
        critical: "criticalPulse 2s ease-in-out infinite",
        flash: "updateFlash 200ms ease-out"
      }
    }
  },
  plugins: []
};

export default config;
