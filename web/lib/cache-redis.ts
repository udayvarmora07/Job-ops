import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const TTL = {
  evaluate_job: 7 * 24 * 60 * 60,
  tailor_cv: 30 * 24 * 60 * 60,
  cover_letter: 30 * 24 * 60 * 60,
  interview_prep: 14 * 24 * 60 * 60,
  search_people: 24 * 60 * 60,
  dashboard_stats: 5 * 60,
};

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    /* cache write is best-effort */
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {
    /* ignore */
  }
}

export function cacheKey(task: string, ...parts: string[]): string {
  return `jobops:${task}:${parts.join("|").toLowerCase().replace(/\s+/g, " ").trim()}`;
}

export function getRedis(): Redis {
  return redis;
}
