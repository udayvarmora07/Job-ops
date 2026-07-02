export default async function (job) {
  await job.updateProgress({ step: 1, total: 3, message: "Starting portal scan..." });

  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);

  await job.updateProgress({ step: 2, total: 3, message: "Running scan.mjs..." });

  const { stdout, stderr } = await execFileAsync(process.execPath, ["scan.mjs"], {
    cwd: new URL("../..", import.meta.url).pathname,
    timeout: 120_000,
  });

  await job.updateProgress({ step: 3, total: 3, message: "Scan complete" });

  return { stdout, stderr };
}
