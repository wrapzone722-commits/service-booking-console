/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg))",
        fg: "hsl(var(--fg))",
        muted: "hsl(var(--muted))",
        "muted-fg": "hsl(var(--muted-fg))",
        card: "hsl(var(--card))",
        "card-fg": "hsl(var(--card-fg))",
        border: "hsl(var(--border))",
        accent: "hsl(var(--accent))",
        "accent-fg": "hsl(var(--accent-fg))",
        destructive: "hsl(var(--destructive))",
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        ios: "0 10px 30px rgba(0,0,0,0.06)",
        ios2: "0 6px 18px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};
