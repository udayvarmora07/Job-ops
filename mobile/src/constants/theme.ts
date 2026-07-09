/**
 * Design tokens — Meridian "Warm".
 *
 * A single dark, warm-paper palette (gold on near-black, never navy/indigo)
 * shared with the web dashboard. Existing key names are preserved so every
 * screen keeps working; the values are remapped onto the warm palette and a
 * few surface/accent tokens are added.
 */
export const colors = {
  bg: "#080808",
  card: "#0E0C08", // s1 — card surface
  elevated: "#141209", // s2 — elevated surface
  hover: "#1A1710", // s3
  active: "#201E15", // s4
  brand: "#C8920A", // amber — scores, achievement, accent
  brandFg: "#080808", // near-black text on amber
  text: "#EDE8D8", // t1 — warm paper
  muted: "#A09880", // t2 — secondary text
  subtle: "#4A4437", // t3 — muted text
  border: "rgba(237,232,216,0.10)", // warm rule
  borderStrong: "rgba(237,232,216,0.18)",
  good: "#3AC98A", // green — verified, success
  warn: "#C8920A", // amber
  bad: "#E06363", // red — rejected, overdue
  info: "#C8920A", // amber (no cold blues in Meridian)
  amberDim: "rgba(200,146,10,0.10)",
  greenDim: "rgba(58,201,138,0.10)",
  redDim: "rgba(224,99,99,0.10)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

/** Color for a 0–5 fit score. Meridian reserves amber for the score itself. */
export function scoreColor(score: number | null | undefined): string {
  if (score == null) return colors.subtle;
  return colors.brand;
}

/** Color for a canonical application status (warm semantics). */
export function statusColor(status: string): string {
  switch (status) {
    case "Offer":
    case "Interview":
      return colors.good;
    case "Responded":
    case "Applied":
      return colors.warn;
    case "Rejected":
    case "Discarded":
    case "SKIP":
      return colors.bad;
    default:
      return colors.muted;
  }
}
