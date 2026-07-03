import { formatDistanceToNow, parseISO, isValid } from "date-fns";

/** "3 days ago" from a YYYY-MM-DD or ISO string. */
export function relativeDate(input: string | null | undefined): string {
  if (!input) return "";
  const d = parseISO(input);
  if (!isValid(d)) return input;
  return formatDistanceToNow(d, { addSuffix: true });
}

/** Normalize a score string like "4.2/5" or number into a 0–5 number. */
export function parseScore(score: string | number | null | undefined): number | null {
  if (score == null) return null;
  if (typeof score === "number") return score;
  const m = score.match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

/** "4.2" (one decimal) for display, or "—". */
export function formatScore(score: number | null | undefined): string {
  if (score == null) return "—";
  return score.toFixed(1);
}

/** Star string for a 0–5 score, e.g. "★★★★☆". */
export function scoreStars(score: number | null | undefined): string {
  const s = Math.max(0, Math.min(5, Math.round(score ?? 0)));
  return "★".repeat(s) + "☆".repeat(5 - s);
}

/** Short host label from a URL, e.g. "boards.greenhouse.io". */
export function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
