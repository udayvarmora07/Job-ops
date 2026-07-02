import { NextResponse } from "next/server";
import { detectPlatform } from "../detect-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ")
    .trim();
}

// LinkedIn: /jobs/view/senior-sre-engineer-at-company-name-1234567890
function parseLinkedInUrl(url: string): { title: string; company: string } | null {
  const m = url.match(/linkedin\.com\/jobs\/(?:view|collections)\/([^/?#]+)/i);
  if (!m) return null;
  const slug = m[1].replace(/-\d+\/?$/, ""); // strip trailing numeric ID
  const atIdx = slug.lastIndexOf("-at-");
  if (atIdx > 0) {
    return {
      title: titleCase(slug.slice(0, atIdx)),
      company: titleCase(slug.slice(atIdx + 4)),
    };
  }
  return null;
}

const INDIAN_CITIES = new Set([
  "bangalore", "bengaluru", "mumbai", "delhi", "gurugram", "gurgaon",
  "noida", "hyderabad", "chennai", "pune", "kolkata", "ahmedabad",
  "jaipur", "chandigarh", "kochi", "lucknow", "surat", "indore",
  "bhopal", "nagpur", "vadodara", "coimbatore", "vizag", "visakhapatnam",
  "remote",
]);

// Naukri: /job-listings-{role}-{company}-{city}-{exp}-{id}
function parseNaukriUrl(url: string): { title: string; company: string } | null {
  const m = url.match(/naukri\.com\/job-listings-(.+)/i);
  if (!m) return null;

  // Strip trailing numeric ID (6+ digits)
  let slug = m[1].replace(/-\d{6,}\/?$/, "").toLowerCase();

  // Strip experience pattern at the end: "1-to-4-years", "3-5-yrs", "5-years"
  slug = slug.replace(/-\d+[\s-]to[\s-]\d+[\s-](?:years?|yrs?)$/, "");
  slug = slug.replace(/-\d+[\s-](?:years?|yrs?)$/, "");

  const parts = slug.split("-").filter(Boolean);

  // Find rightmost known city word
  let cityIdx = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (INDIAN_CITIES.has(parts[i])) { cityIdx = i; break; }
  }

  // Everything before city: role-words + company-word(s)
  const beforeCity = cityIdx >= 0 ? parts.slice(0, cityIdx) : parts;

  // Heuristic: last 1–2 short words before city = company name
  // (company names like "bain", "phonepe", "google" are typically short)
  if (beforeCity.length >= 4) {
    // Check if last word looks like a company (not a generic job-title word)
    const genericWords = new Set(["engineer", "developer", "manager", "analyst", "lead", "senior", "junior", "staff", "principal", "associate", "specialist"]);
    const lastWord = beforeCity[beforeCity.length - 1];
    if (!genericWords.has(lastWord)) {
      const company = titleCase(lastWord);
      const role = titleCase(beforeCity.slice(0, -1).join("-"));
      return { title: role, company };
    }
  }

  // Fallback: return full cleaned slug as title, no company
  return { title: titleCase(beforeCity.join("-")), company: "" };
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'");
}

function parseJobTitle(raw: string): { title: string; company: string } {
  const s = decodeHtml(raw).trim();
  // "Title at Company | Site" or "Title at Company - Site"
  const atMatch = s.match(/^(.+?)\s+at\s+([^|·\-]+?)(?:\s*[|·-].*)?$/i);
  if (atMatch) return { title: atMatch[1].trim(), company: atMatch[2].trim() };
  // "Title | Company | Site" or "Title · Company"
  const pipeParts = s.split(/\s*[|·]\s*/);
  if (pipeParts.length >= 2 && pipeParts[0] && pipeParts[1]) {
    return { title: pipeParts[0].trim(), company: pipeParts[1].trim() };
  }
  // "Title - Company - Site"
  const dashParts = s.split(/\s{1,2}-\s{1,2}/);
  if (dashParts.length >= 2) return { title: dashParts[0].trim(), company: dashParts[1].trim() };
  return { title: s, company: "" };
}

async function fetchPageMeta(
  url: string
): Promise<{ title: string; company: string; location: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return { title: "", company: "", location: "" };
    const html = await res.text();

    // Try og:title first (most structured)
    const ogTitle =
      html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ||
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i)?.[1] ||
      "";

    // og:description sometimes has "Company · Location"
    const ogDesc =
      html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1] ||
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i)?.[1] ||
      "";

    const pageTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "";

    const raw = ogTitle || pageTitle;
    const parsed = raw ? parseJobTitle(raw) : { title: "", company: "" };

    // Try to extract location from og:description or a known pattern
    let location = "";
    if (ogDesc) {
      const locMatch = decodeHtml(ogDesc).match(/·\s*([^·]+(?:India|Remote|Bengaluru|Bangalore|Mumbai|Delhi|Hyderabad|Chennai|Pune|Gurugram|Noida)[^·]*)/i);
      if (locMatch) location = locMatch[1].trim();
    }

    return { ...parsed, location };
  } catch {
    clearTimeout(timer);
    return { title: "", company: "", location: "" };
  }
}

export async function POST(req: Request) {
  let body: { url?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const url = (body.url || "").trim();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const platform = detectPlatform(url);

  // Try URL-slug parsing first (zero-cost, works offline)
  let parsed: { title: string; company: string } | null = null;
  if (platform === "linkedin") parsed = parseLinkedInUrl(url);
  else if (platform === "naukri") parsed = parseNaukriUrl(url);

  // If slug parse didn't yield results, try HTTP fetch
  let location = "";
  if (!parsed || (!parsed.title && !parsed.company)) {
    const fetched = await fetchPageMeta(url);
    parsed = { title: fetched.title, company: fetched.company };
    location = fetched.location;
  }

  return NextResponse.json({
    title: parsed?.title || "",
    company: parsed?.company || "",
    location,
    platform,
  });
}
