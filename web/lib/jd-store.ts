/**
 * web/lib/jd-store.ts — a small URL-keyed store for fetched job descriptions.
 *
 * When a job is added to the pipeline, its full JD (+ metadata) is cached here so
 * every downstream consumer — resume tailoring, QA, evaluation — uses the REAL
 * description instead of a Role/Company/Location stub. Keyed by a hash of the URL
 * so lookups are stable regardless of tracking-param noise.
 *
 * Files live in <root>/data/jd-cache/<hash>.json (gitignored data dir).
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { dataDir } from "./paths";

export interface StoredJd {
  url: string;
  title: string;
  company: string;
  location: string;
  jd: string;
  /** How the JD was obtained: fetch source string, or "manual" for pasted text. */
  source: string;
  platform: string;
  fetchedAt: string;
}

function cacheDir(): string {
  return path.join(dataDir(), "jd-cache");
}

/** Normalise a URL for keying: drop query/hash + trailing slash so the same job
 *  added with different tracking params resolves to one entry. */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const u = new URL(trimmed);
    // Indeed's ?jk= is the job identity — keep it; strip everything else.
    const jk = u.searchParams.get("jk");
    u.search = jk ? `?jk=${jk}` : "";
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return trimmed;
  }
}

function keyFor(url: string): string {
  return crypto.createHash("sha1").update(normalizeUrl(url)).digest("hex").slice(0, 16);
}

function fileFor(url: string): string {
  return path.join(cacheDir(), `${keyFor(url)}.json`);
}

export function getJd(url: string): StoredJd | null {
  try {
    return JSON.parse(fs.readFileSync(fileFor(url), "utf8")) as StoredJd;
  } catch {
    return null;
  }
}

export function saveJd(entry: StoredJd): void {
  fs.mkdirSync(cacheDir(), { recursive: true });
  fs.writeFileSync(fileFor(entry.url), JSON.stringify(entry, null, 2), "utf8");
}

export function hasJd(url: string): boolean {
  const e = getJd(url);
  return !!e && e.jd.trim().length > 0;
}
