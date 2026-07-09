/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Meridian "Warm" — aligned with src/constants/theme.ts
        bg: {
          DEFAULT: "#080808",
          card: "#0E0C08", // s1
          elevated: "#141209", // s2
          hover: "#1A1710", // s3
          active: "#201E15", // s4
        },
        brand: {
          DEFAULT: "#C8920A", // amber
          fg: "#080808",
        },
        paper: "#EDE8D8", // t1 — warm paper (primary text)
        muted: "#A09880", // t2
        subtle: "#4A4437", // t3
        border: "rgba(237,232,216,0.10)",
        // Score / status accents
        good: "#3AC98A",
        warn: "#C8920A",
        bad: "#E06363",
        info: "#C8920A",
      },
    },
  },
  plugins: [],
};
