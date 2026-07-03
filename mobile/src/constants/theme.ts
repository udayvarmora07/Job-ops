/**
 * Design tokens. Mirror the Tailwind palette in tailwind.config.js so both
 * className styling and imperative RN styles stay consistent.
 */
export const colors = {
  bg: "#0B1120",
  card: "#111827",
  elevated: "#1F2937",
  brand: "#6366F1",
  brandFg: "#FFFFFF",
  text: "#F9FAFB",
  muted: "#9CA3AF",
  border: "#1F2937",
  good: "#22C55E",
  warn: "#F59E0B",
  bad: "#EF4444",
  info: "#3B82F6",
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

/** Color for a 0–5 fit score. */
export function scoreColor(score: number | null | undefined): string {
  if (score == null) return colors.muted;
  if (score >= 4.0) return colors.good;
  if (score >= 3.0) return colors.warn;
  return colors.bad;
}

/** Color for a canonical application status. */
export function statusColor(status: string): string {
  switch (status) {
    case "Offer":
      return colors.good;
    case "Interview":
      return colors.info;
    case "Responded":
    case "Applied":
      return colors.brand;
    case "Rejected":
    case "Discarded":
    case "SKIP":
      return colors.bad;
    default:
      return colors.muted;
  }
}
