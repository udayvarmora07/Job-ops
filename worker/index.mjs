import { Worker } from "bullmq";
import Redis from "ioredis";

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const workers: Worker[] = [];

function createWorker(name: string, processor: string) {
  const { default: fn } = await import(processor);
  const w = new Worker(name, fn, { connection });
  workers.push(w);
  w.on("completed", (job) => console.log(`[${name}] Job ${job.id} completed`));
  w.on("failed", (job, err) => console.error(`[${name}] Job ${job?.id} failed:`, err));
  return w;
}

async function main() {
  createWorker("evaluate", "./jobs/evaluate-job.mjs");
  createWorker("scan", "./jobs/scan-portals.mjs");
  createWorker("liveness", "./jobs/liveness-check.mjs");
  createWorker("pdf", "./jobs/generate-pdf.mjs");

  console.log("Jobops worker started — listening for jobs...");

  process.on("SIGTERM", async () => {
    console.log("Shutting down...");
    await Promise.all(workers.map((w) => w.close()));
    await connection.quit();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
