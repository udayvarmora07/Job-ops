export default async function (job) {
  const { url } = job.data;
  await job.updateProgress({ step: 1, total: 2, message: `Checking liveness: ${url}` });

  const { checkLiveness } = await import("../../liveness-core.mjs");
  const result = checkLiveness(url);

  await job.updateProgress({ step: 2, total: 2, message: "Done" });
  return result;
}
