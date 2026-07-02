import { Queue } from "bullmq";
import Redis from "ioredis";

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const evaluateQueue = new Queue("evaluate", { connection });
export const scanQueue = new Queue("scan", { connection });
export const livenessQueue = new Queue("liveness", { connection });
export const pdfQueue = new Queue("pdf", { connection });

export async function closeQueues() {
  await Promise.all([
    evaluateQueue.close(),
    scanQueue.close(),
    livenessQueue.close(),
    pdfQueue.close(),
  ]);
  await connection.quit();
}
