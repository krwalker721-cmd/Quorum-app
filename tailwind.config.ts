import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        card: "var(--card)",
        "card-elev": "var(--card-elev)",
        border: "var(--border)",
        "border-amber": "var(--border-amber)",
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          faint: "var(--text-faint)",
        },
        amber: "#f59e0b",
        green: "#22c55e",
        blue: "#38bdf8",
        purple: "#a78bfa",
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
