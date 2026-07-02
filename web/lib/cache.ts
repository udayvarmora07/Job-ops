import Database from "better-sqlite3";
import path from "path";
import { dataDir } from "./paths";

/**
 * Tiny SQLite cache for AI/derived outputs (referral targets, found people, …).
 *
 * Purpose: when you close and reopen a job, results come back instantly without
 * re-calling the LLM / Apify. The canonical pipeline data (tracker, reports)
 * stays in its markdown/JSON files — this DB only holds derived, recomputable
 * results, so it's safe to delete (data/jobops.db).
 */

let _db: Database.Database | null = null;

function db(): Database.Database {
  if (_db) return _db;
  _db = new Database(path.join(dataDir(), "jobops.db"));
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS ai_cache (
      key        TEXT PRIMARY KEY,
      task       TEXT NOT NULL,
      scope      TEXT,
      payload    TEXT NOT NULL,
      model      TEXT,
      created_at TEXT NOT NULL
    );
  `);
  return _db;
}

export interface CacheHit<T = unknown> {
  payload: T;
  model: string | null;
  createdAt: string;
}

/** Build a stable cache key from a task + scope parts. */
export function cacheKey(task: string, ...parts: (string | null | undefined)[]): string {
  const scope = parts
    .map((p) => (p || "").toLowerCase().replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("|");
  return `${task}:${scope}`;
}

export function cacheGet<T = unknown>(key: string): CacheHit<T> | null {
  try {
    const row = db()
      .prepare("SELECT payload, model, created_at FROM ai_cache WHERE key = ?")
      .get(key) as { payload: string; model: string | null; created_at: string } | undefined;
    if (!row) return null;
    return { payload: JSON.parse(row.payload) as T, model: row.model, createdAt: row.created_at };
  } catch {
    return null;
  }
}

export function cacheSet(
  key: string,
  task: string,
  scope: string,
  payload: unknown,
  model?: string | null
): void {
  try {
    db()
      .prepare(
        `INSERT OR REPLACE INTO ai_cache (key, task, scope, payload, model, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(key, task, scope, JSON.stringify(payload), model ?? null, new Date().toISOString());
  } catch {
    /* cache write is best-effort */
  }
}

export function cacheDelete(key: string): void {
  try {
    db().prepare("DELETE FROM ai_cache WHERE key = ?").run(key);
  } catch {
    /* ignore */
  }
}
