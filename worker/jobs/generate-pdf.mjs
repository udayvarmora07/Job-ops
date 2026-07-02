export default async function (job) {
  const { jd, company, role } = job.data;
  await job.updateProgress({ step: 1, total: 3, message: "Starting PDF generation..." });

  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);

  await job.updateProgress({ step: 2, total: 3, message: "Running generate-pdf.mjs..." });

  const root = new URL("../..", import.meta.url).pathname;
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    ["generate-pdf.mjs", `--jd=${jd}`, `--company=${company}`, `--role=${role}`],
    { cwd: root, timeout: 120_000 }
  );

  await job.updateProgress({ step: 3, total: 3, message: "PDF generated" });
  return { stdout, stderr };
}
