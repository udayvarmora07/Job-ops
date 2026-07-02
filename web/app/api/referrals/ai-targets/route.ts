import { NextResponse } from "next/server";
import { runTask } from "../../../../../lib-ai/run.mjs";
import {
  buildReferralTargets,
  parseReferralTargets,
} from "../../../../../lib-ai/tasks/referral-targets.mjs";
import { cacheGet, cacheSet, cacheKey } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

function linkedinSearch(keywords: string): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
    keywords
  )}&origin=GLOBAL_SEARCH_HEADER`;
}
function googleXray(company: string, keywords: string): string {
  const q = `site:linkedin.com/in "${company}" ${keywords}`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/** GET /api/referrals/ai-targets?company=&role= → cached result only (no LLM call). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const company = (url.searchParams.get("company") || "").trim();
  const role = (url.searchParams.get("role") || "").trim();
  if (!company) return NextResponse.json({ cached: false, targets: [] });
  const hit = cacheGet(cacheKey("referral_targets", company, role));
  if (!hit) return NextResponse.json({ cached: false, targets: [] });
  return NextResponse.json({ cached: true, ...(hit.payload as object) });
}

/**
 * POST /api/referrals/ai-targets  body: { company, role?, jd?, refresh? }
 * Returns cached targets instantly unless refresh=true, otherwise runs the LLM
 * and caches the result (so reopening a job costs zero API calls).
 */
export async function POST(req: Request) {
  let body: { company?: string; role?: string; jd?: string; refresh?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const company = (body.company || "").trim();
  const role = (body.role || "").trim();
  if (!company) {
    return NextResponse.json({ error: "company required" }, { status: 400 });
  }

  const key = cacheKey("referral_targets", company, role);
  if (!body.refresh) {
    const hit = cacheGet(key);
    if (hit) return NextResponse.json({ cached: true, ...(hit.payload as object) });
  }

  try {
    const { system, prompt } = buildReferralTargets({
      company,
      role,
      jd: (body.jd || "").trim() || undefined,
    });
    const r = await runTask("referral_targets", { system, prompt, temperature: 0.3 });
    const obj = parseReferralTargets(r.text);

    const targets = (obj.targets || []).map(
      (t: { linkedinKeywords?: string; [k: string]: unknown }) => {
        const kw = (t.linkedinKeywords || "").trim();
        return {
          ...t,
          linkedinUrl: linkedinSearch(`${company} ${kw}`.trim()),
          googleUrl: googleXray(company, kw),
        };
      }
    );

    const payload = { company, role, strategy: obj.strategy || "", targets, model: r.model };
    cacheSet(key, "referral_targets", `${company}|${role}`, payload, r.model);
    return NextResponse.json({ cached: false, ...payload });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
