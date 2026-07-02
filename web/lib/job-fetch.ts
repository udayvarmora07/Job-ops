/**
 * web/lib/job-fetch.ts — unified, tiered job-posting fetcher.
 *
 * Given ANY job URL (LinkedIn, Naukri, Indeed, Greenhouse, Lever, Ashby,
 * company career pages, …) this returns complete structured job data:
 *   { title, company, location, jd, source, platform }
 *
 * Strategy (cheapest first; stops at the first that yields a real JD):
 *   1. Portal APIs / guest endpoints  — LinkedIn guest, Greenhouse, Lever,
 *      Ashby, Recruitee, Workable.               (fast, free, structured)
 *   2. Generic HTTP + JSON-LD JobPosting.         (fast, free)
 *   3. Playwright headless render.                (slow, handles JS/protected
 *      Naukri, Indeed, company SPAs)
 *
 * If none produce a usable JD (login walls, hard bot-protection), it throws a
 * JobFetchError with a specific, human-readable reason — never a silent stub.
 * The caller surfaces that error and offers a manual-paste fallback.
 */

import { detectPlatform } from "@/app/api/pipeline/detect-platform";

export interface FetchedJob {
  title: string;
  company: string;
  location: string;
  jd: string;
  /** Which strategy produced the JD, e.g. "linkedin-guest", "jsonld", "playwright". */
  source: string;
  platform: string;
}

/** Thrown when a usable JD could not be extracted. `code` is machine-readable. */
export class JobFetchError extends Error {
  code: string;
  platform: string;
  constructor(message: string, code: string, platform: string) {
    super(message);
    this.name = "JobFetchError";
    this.code = code;
    this.platform = platform;
  }
}

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** A JD shorter than this is treated as "not really a description" (nav/footer only). */
const MIN_JD_LEN = 120;

// ─── HTML → text helpers ────────────────────────────────────────────────────
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<\/(h[1-6]|div|ul|ol|section|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[ \t]+| [ \t]+$/gm, "")
    .trim();
}

function clean(jd: string | null | undefined): string {
  return (jd || "").trim();
}

function usable(jd: string | null | undefined): boolean {
  return clean(jd).length >= MIN_JD_LEN;
}

// ─── JSON-LD JobPosting extraction (works for many boards + company pages) ───
interface LdJob {
  title?: string;
  company?: string;
  location?: string;
  jd?: string;
}

function pickJobPosting(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  const t = obj["@type"];
  const isJob = t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"));
  if (isJob) return obj;
  if (Array.isArray(obj["@graph"])) {
    for (const g of obj["@graph"] as unknown[]) {
      const hit = pickJobPosting(g);
      if (hit) return hit;
    }
  }
  return null;
}

function parseJsonLdJob(html: string): LdJob | null {
  const blocks =
    html.match(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    ) || [];
  for (const block of blocks) {
    const raw = block.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    for (const c of candidates) {
      const job = pickJobPosting(c);
      if (!job) continue;
      const org = job.hiringOrganization as Record<string, unknown> | undefined;
      const loc = job.jobLocation;
      let location = "";
      const firstLoc = Array.isArray(loc) ? loc[0] : loc;
      const addr = (firstLoc as Record<string, unknown> | undefined)?.address as
        | Record<string, unknown>
        | undefined;
      if (addr) {
        location = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
          .filter(Boolean)
          .join(", ");
      }
      return {
        title: typeof job.title === "string" ? job.title.trim() : "",
        company: typeof org?.name === "string" ? (org.name as string).trim() : "",
        location,
        jd: typeof job.description === "string" ? stripHtml(job.description) : "",
      };
    }
  }
  return null;
}

// ─── Tier 1: portal APIs / guest endpoints ──────────────────────────────────
async function getJson(url: string, opts: RequestInit = {}): Promise<any | null> {
  const res = await fetch(url, {
    ...opts,
    headers: { Accept: "application/json", "User-Agent": UA, ...(opts.headers || {}) },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

async function getText(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(12000),
    redirect: "follow",
  });
  if (!res.ok) return null;
  return res.text();
}

/** LinkedIn: use the public guest job-posting endpoint (no auth needed). */
async function fetchLinkedIn(url: string): Promise<FetchedJob | null> {
  const m = url.match(/(?:jobs\/view\/|currentJobId=|jobPosting\/)(\d{6,})/i) || url.match(/-(\d{8,})(?:[/?#]|$)/);
  const id = m?.[1];
  if (!id) return null;
  const html = await getText(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`);
  if (!html) return null;
  const jdMatch =
    html.match(/show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/description__text[^>]*>([\s\S]*?)<\/section>/i);
  const jd = jdMatch ? stripHtml(jdMatch[1]) : "";
  const title = stripHtml(html.match(/top-card-layout__title[^>]*>([\s\S]*?)<\//i)?.[1] || "");
  const company = stripHtml(
    html.match(/topcard__org-name-link[^>]*>([\s\S]*?)<\//i)?.[1] ||
      html.match(/topcard__flavor[^>]*>([\s\S]*?)<\//i)?.[1] ||
      ""
  );
  const location = stripHtml(html.match(/topcard__flavor--bullet[^>]*>([\s\S]*?)<\//i)?.[1] || "");
  if (!usable(jd)) return null;
  return { title, company, location, jd, source: "linkedin-guest", platform: "linkedin" };
}

async function fetchGreenhouse(url: string): Promise<FetchedJob | null> {
  const m = url.match(/greenhouse\.io\/([^/?#]+)\/jobs\/(\d+)/i);
  if (!m) return null;
  const j = await getJson(`https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs/${m[2]}`);
  if (!j?.content) return null;
  return {
    title: j.title || "",
    company: m[1],
    location: j.location?.name || "",
    jd: stripHtml(j.content),
    source: "greenhouse-api",
    platform: "greenhouse",
  };
}

async function fetchLever(url: string): Promise<FetchedJob | null> {
  const m = url.match(/jobs\.lever\.co\/([^/?#]+)\/([^/?#]+)/i);
  if (!m) return null;
  const j = await getJson(`https://api.lever.co/v0/postings/${m[1]}/${m[2]}`);
  if (!j) return null;
  const jd = clean(j.descriptionPlain) || (j.description ? stripHtml(j.description) : "");
  if (!usable(jd)) return null;
  return {
    title: j.text || "",
    company: m[1],
    location: j.categories?.location || "",
    jd,
    source: "lever-api",
    platform: "lever",
  };
}

async function fetchAshby(url: string): Promise<FetchedJob | null> {
  const m = url.match(/ashbyhq\.com\/([^/?#]+)\/([^/?#]+)/i);
  if (!m) return null;
  const j = await getJson("https://jobs.ashbyhq.com/api/non-user-graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operationName: "ApiJobPosting",
      variables: { organizationHostedJobsPageName: m[1], jobPostingId: m[2] },
      query: `query ApiJobPosting($organizationHostedJobsPageName: String!, $jobPostingId: ID!) {
        jobPosting(organizationHostedJobsPageName: $organizationHostedJobsPageName, jobPostingId: $jobPostingId) {
          title locationName descriptionSections { type description }
        }
      }`,
    }),
  });
  const jp = j?.data?.jobPosting;
  if (!jp) return null;
  const jd = (jp.descriptionSections || [])
    .map((s: { description?: string }) => stripHtml(s.description || ""))
    .filter(Boolean)
    .join("\n\n");
  if (!usable(jd)) return null;
  return { title: jp.title || "", company: m[1], location: jp.locationName || "", jd, source: "ashby-api", platform: "ashby" };
}

async function fetchRecruitee(url: string): Promise<FetchedJob | null> {
  const m = url.match(/([^.]+)\.recruitee\.com\/o\/([^/?#]+)/i);
  if (!m) return null;
  const j = await getJson(`https://${m[1]}.recruitee.com/api/offers/${m[2]}`);
  const off = j?.offer;
  if (!off?.description) return null;
  return {
    title: off.title || "",
    company: m[1],
    location: [off.city, off.country].filter(Boolean).join(", "),
    jd: stripHtml(off.description),
    source: "recruitee-api",
    platform: "recruitee",
  };
}

async function fetchWorkable(url: string): Promise<FetchedJob | null> {
  const m =
    url.match(/apply\.workable\.com\/([^/?#]+)\/j\/([^/?#]+)/i) ||
    url.match(/([^.]+)\.workable\.com\/jobs\/([^/?#]+)/i);
  if (!m) return null;
  const j = await getJson(`https://apply.workable.com/api/v3/accounts/${m[1]}/jobs/${m[2]}`);
  if (!j) return null;
  const jd = stripHtml([j.full_description || "", j.requirements || ""].filter(Boolean).join("\n\n"));
  if (!usable(jd)) return null;
  return { title: j.title || "", company: m[1], location: j.location?.city || "", jd, source: "workable-api", platform: "workable" };
}

// ─── Tier 2: generic HTTP + JSON-LD ─────────────────────────────────────────
async function fetchGenericHttp(url: string, platform: string): Promise<FetchedJob | null> {
  const html = await getText(url);
  if (!html) return null;
  const ld = parseJsonLdJob(html);
  if (ld && usable(ld.jd)) {
    return {
      title: ld.title || "",
      company: ld.company || "",
      location: ld.location || "",
      jd: clean(ld.jd),
      source: "jsonld",
      platform,
    };
  }
  return null;
}

// ─── Tier 3: Playwright headless render (JS pages / bot-protected boards) ────
// Known JD containers by platform, tried in order, plus generic fallbacks.
const JD_SELECTORS = [
  '[class*="job-desc"]',
  '[class*="JDC"]',
  '[class*="jobDescription"]',
  ".dang-inner-html",
  '[class*="description__text"]',
  ".show-more-less-html__markup",
  '[data-testid="jobDescriptionText"]',
  "#jobDescriptionText",
  '[class*="job_description"]',
  "article",
  "main",
];

async function fetchWithPlaywright(url: string, platform: string): Promise<FetchedJob | null> {
  // Imported lazily so the module (and its consumers) load even where Playwright
  // isn't installed; only the headless fallback needs it.
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    // These flags materially improve reach: Indeed goes from 403 → 200 with them.
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  try {
    const ctx = await browser.newContext({
      userAgent: UA,
      locale: "en-US",
      viewport: { width: 1366, height: 900 },
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9", "Upgrade-Insecure-Requests": "1" },
    });
    // Mask the most obvious headless tells before any page script runs.
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    // Give client-rendered boards (Naukri, SPAs) a moment to hydrate the JD.
    await page.waitForTimeout(2500);

    const data = await page.evaluate(
      ({ selectors }: { selectors: string[] }) => {
        const out: { title: string; company: string; location: string; jd: string; via: string } = {
          title: document.title || "",
          company: "",
          location: "",
          jd: "",
          via: "",
        };

        // 1. JSON-LD JobPosting present after render?
        const pick = (node: any): any => {
          if (!node || typeof node !== "object") return null;
          const t = node["@type"];
          if (t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"))) return node;
          if (Array.isArray(node["@graph"])) for (const g of node["@graph"]) { const h = pick(g); if (h) return h; }
          return null;
        };
        for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
          try {
            const parsed = JSON.parse(s.textContent || "");
            for (const c of Array.isArray(parsed) ? parsed : [parsed]) {
              const job = pick(c);
              if (job) {
                out.title = job.title || out.title;
                out.company = job.hiringOrganization?.name || "";
                const loc = Array.isArray(job.jobLocation) ? job.jobLocation[0] : job.jobLocation;
                const a = loc?.address;
                if (a) out.location = [a.addressLocality, a.addressRegion, a.addressCountry].filter(Boolean).join(", ");
                if (typeof job.description === "string") { out.jd = job.description; out.via = "jsonld-rendered"; }
                break;
              }
            }
          } catch { /* skip */ }
          if (out.jd) break;
        }

        // 2. Otherwise, grab the largest matching JD container by text length.
        if (!out.jd) {
          let best = "";
          for (const sel of selectors) {
            for (const el of Array.from(document.querySelectorAll(sel))) {
              const txt = (el as HTMLElement).innerText || "";
              if (txt.length > best.length) best = txt;
            }
            if (best.length > 400) { out.via = `selector:${sel}`; break; }
          }
          out.jd = best;
        }

        // Meta fallbacks for company/location.
        const og = (p: string) =>
          (document.querySelector(`meta[property="${p}"]`) as HTMLMetaElement)?.content || "";
        if (!out.company) out.company = og("og:site_name");
        return out;
      },
      { selectors: JD_SELECTORS }
    );

    const jd = data.jd.includes("<") ? stripHtml(data.jd) : clean(data.jd);
    if (!usable(jd)) return null;
    return {
      title: clean(data.title).replace(/\s*[|·\-–].*$/, "").trim(),
      company: clean(data.company),
      location: clean(data.location),
      jd,
      source: `playwright${data.via ? `:${data.via}` : ""}`,
      platform,
    };
  } finally {
    await browser.close();
  }
}

// ─── Orchestrator ───────────────────────────────────────────────────────────
export async function fetchJob(url: string): Promise<FetchedJob> {
  const clean_url = url.trim();
  if (!/^https?:\/\//i.test(clean_url)) {
    throw new JobFetchError("Not a valid http(s) URL.", "bad_url", "unknown");
  }
  const platform = detectPlatform(clean_url);

  // Tier 1 — portal-specific APIs / guest endpoints.
  const tier1: Array<(u: string) => Promise<FetchedJob | null>> = [
    fetchLinkedIn,
    fetchGreenhouse,
    fetchLever,
    fetchAshby,
    fetchRecruitee,
    fetchWorkable,
  ];
  for (const fn of tier1) {
    try {
      const hit = await fn(clean_url);
      if (hit && usable(hit.jd)) return hit;
    } catch {
      /* try next strategy */
    }
  }

  // Tier 2 — generic HTTP + JSON-LD.
  try {
    const hit = await fetchGenericHttp(clean_url, platform);
    if (hit && usable(hit.jd)) return hit;
  } catch {
    /* fall through to headless */
  }

  // Tier 3 — Playwright headless render.
  try {
    const hit = await fetchWithPlaywright(clean_url, platform);
    if (hit && usable(hit.jd)) return hit;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new JobFetchError(
      `Headless fetch failed for ${platform}: ${msg}. Paste the JD manually.`,
      "playwright_error",
      platform
    );
  }

  // Everything tried, nothing usable.
  const hint =
    platform === "indeed" || platform === "instahyre" || platform === "glassdoor"
      ? `${platform} requires login / blocks automated access. Paste the JD text manually.`
      : `Could not extract a job description from this ${platform} URL. Paste the JD text manually.`;
  throw new JobFetchError(hint, "no_jd", platform);
}
