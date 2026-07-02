import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchGreenhouse(url: string): Promise<string | null> {
  // https://boards.greenhouse.io/{slug}/jobs/{id}
  // https://job-boards.greenhouse.io/{slug}/jobs/{id}
  const m = url.match(/greenhouse\.io\/([^/?#]+)\/jobs\/(\d+)/i);
  if (!m) return null;
  const [, slug, id] = m;
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs/${id}`;
  const res = await fetch(apiUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.content ? stripHtml(json.content) : null;
}

async function fetchLever(url: string): Promise<string | null> {
  // https://jobs.lever.co/{company}/{id}
  const m = url.match(/jobs\.lever\.co\/([^/?#]+)\/([^/?#]+)/i);
  if (!m) return null;
  const [, company, id] = m;
  const apiUrl = `https://api.lever.co/v0/postings/${company}/${id}`;
  const res = await fetch(apiUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.descriptionPlain || (json.description ? stripHtml(json.description) : null);
}

async function fetchAshby(url: string): Promise<string | null> {
  // https://jobs.ashbyhq.com/{company}/{id}
  const m = url.match(/ashbyhq\.com\/([^/?#]+)\/([^/?#]+)/i);
  if (!m) return null;
  const [, company, id] = m;
  const res = await fetch("https://jobs.ashbyhq.com/api/non-user-graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operationName: "ApiJobPosting",
      variables: { organizationHostedJobsPageName: company, jobPostingId: id },
      query: `query ApiJobPosting($organizationHostedJobsPageName: String!, $jobPostingId: ID!) {
        jobPosting(organizationHostedJobsPageName: $organizationHostedJobsPageName, jobPostingId: $jobPostingId) {
          title
          descriptionSections { type description }
        }
      }`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const sections: { description?: string }[] = json?.data?.jobPosting?.descriptionSections || [];
  const text = sections.map((s) => stripHtml(s.description || "")).filter(Boolean).join("\n\n");
  return text || null;
}

async function fetchRecruitee(url: string): Promise<string | null> {
  // https://{company}.recruitee.com/o/{role-slug}
  const m = url.match(/([^.]+)\.recruitee\.com\/o\/([^/?#]+)/i);
  if (!m) return null;
  const [, company, slug] = m;
  const apiUrl = `https://${company}.recruitee.com/api/offers/${slug}`;
  const res = await fetch(apiUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.offer?.description ? stripHtml(json.offer.description) : null;
}

async function fetchWorkable(url: string): Promise<string | null> {
  // https://apply.workable.com/{company}/j/{id}
  // or https://{company}.workable.com/jobs/{id}
  const m =
    url.match(/apply\.workable\.com\/([^/?#]+)\/j\/([^/?#]+)/i) ||
    url.match(/([^.]+)\.workable\.com\/jobs\/([^/?#]+)/i);
  if (!m) return null;
  const [, company, id] = m;
  const apiUrl = `https://apply.workable.com/api/v3/accounts/${company}/jobs/${id}`;
  const res = await fetch(apiUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const parts = [json.full_description || "", json.requirements || ""].filter(Boolean);
  return parts.length ? stripHtml(parts.join("\n\n")) : null;
}

async function fetchGeneric(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(10000),
    redirect: "follow",
  });
  if (!res.ok) return null;
  const html = await res.text();
  // Try structured JSON-LD first (many job boards embed it)
  const ldMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (ldMatch) {
    for (const block of ldMatch) {
      try {
        const json = JSON.parse(block.replace(/<[^>]+>/g, ""));
        if (json["@type"] === "JobPosting" && json.description) {
          return stripHtml(json.description).slice(0, 6000);
        }
      } catch { /* skip */ }
    }
  }
  // Fallback: strip full body
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return null;
  return stripHtml(bodyMatch[1]).replace(/\s{2,}/g, " ").slice(0, 5000) || null;
}

/**
 * POST /api/outreach/fetch-jd
 * body: { url: string }
 * → { jd: string }
 *
 * Fetches the job description text for a given job URL, trying ATS APIs
 * (Greenhouse, Lever, Ashby, Recruitee, Workable) before falling back to
 * generic HTML scraping. Returns up to 6 000 chars of plain text.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  try {
    let jd: string | null = null;

    if (url.includes("greenhouse.io")) jd = await fetchGreenhouse(url);
    else if (url.includes("lever.co")) jd = await fetchLever(url);
    else if (url.includes("ashbyhq.com")) jd = await fetchAshby(url);
    else if (url.includes("recruitee.com")) jd = await fetchRecruitee(url);
    else if (url.includes("workable.com")) jd = await fetchWorkable(url);

    if (!jd) jd = await fetchGeneric(url);

    if (!jd || jd.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract JD from this URL — try a different job or use the hiring post flow." },
        { status: 422 }
      );
    }

    return NextResponse.json({ jd: jd.slice(0, 6000) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
