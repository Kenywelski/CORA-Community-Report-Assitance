import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./frontend/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border, 180 15% 90%) / <alpha-value>)",
        input: "hsl(var(--input, 180 15% 90%) / <alpha-value>)",
        ring: "hsl(var(--ring, 174 62% 28%) / <alpha-value>)",
        background: "hsl(var(--background, 180 20% 98%) / <alpha-value>)",
        foreground: "hsl(var(--foreground, 200 50% 10%) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary, 174 62% 28%) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground, 0 0% 100%) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary, 174 30% 94%) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground, 174 62% 28%) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive, 0 84% 60%) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground, 0 0% 100%) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted, 180 15% 95%) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground, 200 20% 45%) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent, 16 85% 58%) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground, 0 0% 100%) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover, 0 0% 100%) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground, 200 50% 10%) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card, 0 0% 100%) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground, 200 50% 10%) / <alpha-value>)",
        },
        emergency: {
          DEFAULT: "hsl(var(--emergency, 12 90% 52%) / <alpha-value>)",
          foreground: "hsl(var(--emergency-foreground, 0 0% 100%) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success, 152 60% 42%) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground, 0 0% 100%) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning, 38 92% 50%) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground, 0 0% 10%) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background, 0 0% 98%) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground, 240 5.3% 26.1%) / <alpha-value>)",
          primary: "hsl(var(--sidebar-primary, 240 5.9% 10%) / <alpha-value>)",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground, 0 0% 98%) / <alpha-value>)",
          accent: "hsl(var(--sidebar-accent, 240 4.8% 95.9%) / <alpha-value>)",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground, 240 5.9% 10%) / <alpha-value>)",
          border: "hsl(var(--sidebar-border, 220 13% 91%) / <alpha-value>)",
          ring: "hsl(var(--sidebar-ring, 217.2 91.2% 59.8%) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        'soft': 'var(--shadow-md)',
        'glow': 'var(--shadow-glow)',
        'elevated': 'var(--shadow-xl)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(10px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "bounce-soft": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "bounce-soft": "bounce-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
