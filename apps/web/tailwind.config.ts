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
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "monospace"],
      },
      colors: {
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
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
        "micro": "150ms cubic-bezier(0.16, 1, 0.3, 1)",
        "fast": "200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "normal": "300ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slow": "500ms cubic-bezier(0.16, 1, 0.3, 1)",
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
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "16px",
        "3xl": "24px",
      },
      boxShadow: {
        "level-1": "0 1px 2px rgba(0,0,0,0.04)",
        "level-2": "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "level-3": "0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)",
        "level-4": "0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04)",
        "level-5": "0 20px 40px rgba(0,0,0,0.12), 0 8px 12px rgba(0,0,0,0.06)",
        glow: "0 0 40px rgba(99, 102, 241, 0.2)",
        "glow-lg": "0 0 60px rgba(99, 102, 241, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
