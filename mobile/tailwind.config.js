/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Aligned with src/constants/theme.ts
        bg: {
          DEFAULT: "#0B1120",
          card: "#111827",
          elevated: "#1F2937",
        },
        brand: {
          DEFAULT: "#6366F1",
          fg: "#FFFFFF",
        },
        muted: "#9CA3AF",
        border: "#1F2937",
        // Score / status accents
        good: "#22C55E",
        warn: "#F59E0B",
        bad: "#EF4444",
        info: "#3B82F6",
      },
    },
  },
  plugins: [],
};
