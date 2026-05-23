import type { Config } from "tailwindcss";

/**
 * Obol's design tokens — the agora at dusk: dark stone, bronze coin, a single
 * verdigris signal colour. Headlines in serif, figures and hashes in mono.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0c0b09",
        stone: "#16140f",
        stone2: "#1e1b15",
        edge: "#322c23",
        bronze: "#cda655",
        bronzeDim: "#8a6f3a",
        verdigris: "#6cb89c",
        parchment: "#ece6d6",
        muted: "#968c79",
        danger: "#d2735f",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "Menlo", "monospace"],
      },
      borderRadius: { card: "12px" },
      boxShadow: {
        coin: "0 0 0 1px rgba(205,166,85,0.25), 0 8px 30px -12px rgba(0,0,0,0.8)",
      },
    },
  },
  plugins: [],
};

export default config;
