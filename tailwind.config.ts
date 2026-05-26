import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0d1117",
        card: "#161b22",
        "card-elev": "#1c2128",
        border: "#21262d",
        "border-amber": "rgba(245, 158, 11, 0.25)",
        "bg-base": "#0d1117",
        "bg-surface": "#161b22",
        "bg-elevated": "#1c2128",
        "bg-overlay": "#21262d",
        "border-default": "#21262d",
        "border-muted": "#30363d",
        "text-primary": "#e6edf3",
        "text-secondary": "#8b949e",
        "text-muted": "#6e7681",
        "text-disabled": "#484f58",
        text: {
          primary: "#e6edf3",
          secondary: "#8b949e",
          muted: "#6e7681",
          faint: "#484f58",
        },
        amber: "#f59e0b",
        green: "#22c55e",
        blue: "#58a6ff",
        purple: "#a78bfa",
        red: "#f85149",
        teal: "#38bdf8",
      },
      fontFamily: {
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
        sans: ["var(--font-space-grotesk)", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
};
export default config;
