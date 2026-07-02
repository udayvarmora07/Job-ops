/**
 * Experience requirement extractor.
 *
 * Extracts required years of experience from a job title (and optionally a
 * snippet of JD text stored in scan-history col 8). Purely derived — never
 * stored in canonical data files.
 *
 * Priority order:
 *   1. Explicit year range/number in the text   "4-8 yrs", "8+ years", "1 to 4 Years"
 *   2. Level numbers in role title              "Engineer II", "SRE 3", "SDE-2", "L5"
 *   3. Seniority keyword in title               "Senior", "Lead", "Principal", "Fresher"
 *   4. Fallback                                 null (shown as "—")
 */

export interface ExpInfo {
  /** Human-readable label: "2-4 yr", "5+ yr", "0-2 yr" */
  display: string;
  /** Lower bound in years (for filtering). */
  minYears: number;
  /** Upper bound in years, or null for open-ended (5+ yr). */
  maxYears: number | null;
  /** How the value was derived — useful for debugging. */
  source: "explicit" | "level" | "seniority";
}

function make(
  display: string,
  minYears: number,
  maxYears: number | null,
  source: ExpInfo["source"]
): ExpInfo {
  return { display, minYears, maxYears, source };
}

/**
 * Extract experience requirement from a job title (and an optional plain-text
 * snippet from the JD stored alongside the title).
 *
 * Returns null when no reliable signal is found.
 */
export function extractExp(title: string, jdSnippet = ""): ExpInfo | null {
  const combined = (title + " " + jdSnippet).trim();

  // ── 1. Explicit year range: "4-8 yrs", "7 to 11 years", "1 To 4 Years" ──
  const rangeRe =
    /(\d{1,2})\s*(?:[-–—]|to)\s*(\d{1,2})\s*(?:years?|yrs?)\b/i;
  const rangeM = combined.match(rangeRe);
  if (rangeM) {
    const lo = parseInt(rangeM[1], 10);
    const hi = parseInt(rangeM[2], 10);
    if (lo >= 0 && hi > lo && hi <= 30) {
      return make(`${lo}-${hi} yr`, lo, hi, "explicit");
    }
  }

  // ── 2. Explicit N+ years: "8+ Years", "5+ yrs" ──
  const plusRe = /(\d{1,2})\+\s*(?:years?|yrs?)\b/i;
  const plusM = combined.match(plusRe);
  if (plusM) {
    const n = parseInt(plusM[1], 10);
    if (n >= 0 && n <= 25) return make(`${n}+ yr`, n, null, "explicit");
  }

  // ── 3. Bare "N years" as the only numeric signal (use cautiously) ──
  // Only fires when there's a clear experience-context word nearby,
  // to avoid "founded 5 years ago" false-positives.
  const bareRe = /\b(\d{1,2})\s+(?:years?|yrs?)\b/i;
  const bareCtx =
    /experien|exp\b|minimum|at least|relevant|background|qualif/i;
  const bareM = combined.match(bareRe);
  if (bareM && bareCtx.test(combined)) {
    const n = parseInt(bareM[1], 10);
    if (n >= 1 && n <= 20) return make(`${n}+ yr`, n, null, "explicit");
  }

  // ── 4. Level numbers (higher confidence than seniority words) ──
  // "SDE-1/2/3", "L1..L5", "Engineer I/II/III/IV/V", "SRE 2/3/5"
  const sdeRe = /\bSDE[-–\s]?([1-5])\b/i;
  const sdeM = title.match(sdeRe);
  if (sdeM) {
    const lvl = parseInt(sdeM[1], 10);
    const MAP: Record<number, ExpInfo> = {
      1: make("0-2 yr", 0, 2, "level"),
      2: make("2-4 yr", 2, 4, "level"),
      3: make("4-6 yr", 4, 6, "level"),
      4: make("6-8 yr", 6, 8, "level"),
      5: make("8+ yr", 8, null, "level"),
    };
    if (MAP[lvl]) return MAP[lvl];
  }

  // "L1" .. "L7" — use word-boundary to avoid "Linux", "Lambda", etc.
  const lLvlRe = /\bL([1-7])\b/;
  const lLvlM = title.match(lLvlRe);
  if (lLvlM) {
    const lvl = parseInt(lLvlM[1], 10);
    if (lvl === 1) return make("0-2 yr", 0, 2, "level");
    if (lvl === 2) return make("1-3 yr", 1, 3, "level");
    if (lvl === 3) return make("2-4 yr", 2, 4, "level");
    if (lvl === 4) return make("4-6 yr", 4, 6, "level");
    if (lvl === 5) return make("6-8 yr", 6, 8, "level");
    if (lvl >= 6) return make("8+ yr", 8, null, "level");
  }

  // "Engineer I/II/III/IV/V" or "Engineer - I/II/3/4/5" or "SRE 2/3/5"
  const engLvlRe =
    /\b(?:engineer|sre|sde|swe|developer)\s*[-–]?\s*(?:(i{1,3}|iv|v{1,2})|\b([1-6])\b)\b/i;
  const engM = title.match(engLvlRe);
  if (engM) {
    const roman = (engM[1] || "").toLowerCase();
    const num = engM[2] ? parseInt(engM[2], 10) : 0;
    const level =
      roman === "i" || num === 1
        ? 1
        : roman === "ii" || num === 2
        ? 2
        : roman === "iii" || num === 3
        ? 3
        : roman === "iv" || num === 4
        ? 4
        : roman === "v" || num === 5
        ? 5
        : num === 6
        ? 6
        : 0;
    if (level === 1) return make("0-2 yr", 0, 2, "level");
    if (level === 2) return make("2-4 yr", 2, 4, "level");
    if (level === 3) return make("4-6 yr", 4, 6, "level");
    if (level === 4) return make("6-8 yr", 6, 8, "level");
    if (level >= 5) return make("8+ yr", 8, null, "level");
  }

  // ── 5. Seniority keywords (weakest signal — title only, not jdSnippet) ──
  if (/\b(?:director|head\s+of|vp\b|vice[\s-]president)\b/i.test(title))
    return make("10+ yr", 10, null, "seniority");
  if (/\b(?:principal|distinguished|fellow)\b/i.test(title))
    return make("8+ yr", 8, null, "seniority");
  if (/\b(?:staff)\b/i.test(title))
    return make("6+ yr", 6, null, "seniority");
  if (/\b(?:engineering\s+manager|senior\s+manager|manager)\b/i.test(title))
    return make("6+ yr", 6, null, "seniority");
  if (/\b(?:lead|architect)\b/i.test(title))
    return make("5+ yr", 5, null, "seniority");
  if (/\b(?:senior|sr\.?)\b/i.test(title))
    return make("3+ yr", 3, null, "seniority");
  if (/\b(?:fresher|entry[\s-]level)\b/i.test(title))
    return make("0-1 yr", 0, 1, "seniority");
  if (/\b(?:junior|jr\.?)\b/i.test(title))
    return make("0-2 yr", 0, 2, "seniority");
  if (/\b(?:associate)\b/i.test(title))
    return make("0-3 yr", 0, 3, "seniority");

  return null;
}

/** Bucket for the experience filter dropdown. */
export type ExpBucket = "entry" | "mid" | "senior" | "unknown";

export function expBucket(info: ExpInfo | null): ExpBucket {
  if (!info) return "unknown";
  if (info.minYears < 3) return "entry";
  if (info.minYears < 6) return "mid";
  return "senior";
}
