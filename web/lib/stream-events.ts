import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

/**
 * Subscribe to worker job progress via Redis pub/sub.
 * Returns an async generator that yields progress events.
 */
export async function* subscribeJobProgress(jobId: string): AsyncGenerator<{
  step: number;
  total: number;
  message: string;
}> {
  const channel = `job:${jobId}:progress`;

  const events: { step: number; total: number; message: string }[] = [];
  let done = false;

  const sub = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

  await sub.subscribe(channel);

  sub.on("message", (_channel, message) => {
    try {
      const data = JSON.parse(message);
      events.push(data);
      if (data.done) done = true;
    } catch { /* ignore malformed */ }
  });

  // Poll events
  while (!done) {
    while (events.length > 0) {
      yield events.shift()!;
    }
    if (done) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await sub.unsubscribe(channel);
  await sub.quit();
}

/**
 * Publish worker progress to Redis pub/sub channel.
 * Used by BullMQ workers to report progress.
 */
export async function publishJobProgress(
  jobId: string,
  progress: { step: number; total: number; message: string; done?: boolean }
) {
  const channel = `job:${jobId}:progress`;
  await redis.publish(channel, JSON.stringify(progress));
}
