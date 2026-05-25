import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#6366f1",
          hover: "#4f46e5",
          active: "#4338ca",
          light: "#eef2ff",
        },
        accent: {
          DEFAULT: "#8b5cf6",
          hover: "#7c3aed",
          light: "#f5f3ff",
        },
        surface: {
          DEFAULT: "#ffffff",
          hover: "#fafafa",
          elevated: "#ffffff",
          secondary: "#f5f5f5",
          tertiary: "#eeeeee",
        },
        text: {
          primary: "#0f0f11",
          secondary: "#52525b",
          tertiary: "#a1a1aa",
          inverse: "#ffffff",
        },
        border: {
          DEFAULT: "#e5e7eb",
          light: "#f3f4f6",
        },
        success: {
          DEFAULT: "#10b981",
          bg: "rgba(16, 185, 129, 0.1)",
        },
        warning: "#f59e0b",
        error: {
          DEFAULT: "#ef4444",
          bg: "rgba(239, 68, 68, 0.1)",
        },
        ats: {
          red: "#ef4444",
          amber: "#f59e0b",
          blue: "#3b82f6",
          emerald: "#10b981",
        },
      },
      backgroundImage: {
        "gradient-card": "linear-gradient(135deg, #6366f1, #8b5cf6)",
        "gradient-glow": "linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(139, 92, 246, 0.1))",
        "gradient-hero-light":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.3), transparent)",
        "gradient-hero-dark":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.15), transparent)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
        "typing-cursor": "blink 0.8s step-end infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
      maxWidth: {
        container: "1280px",
      },
      spacing: {
        section: "clamp(64px, 10vw, 128px)",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
      },
      boxShadow: {
        glow: "0 0 40px rgba(99, 102, 241, 0.2)",
        "glow-lg": "0 0 60px rgba(99, 102, 241, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
