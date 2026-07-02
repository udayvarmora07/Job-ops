export default async function (job) {
  const { jd, url, company, role } = job.data;
  const totalSteps = 4;

  await job.updateProgress({ step: 1, total: totalSteps, message: "Starting evaluation..." });

  const { runTask } = await import("../../lib-ai/run.mjs");
  const { buildEvaluateJob } = await import("../../lib-ai/tasks/evaluate-job.mjs");

  await job.updateProgress({ step: 2, total: totalSteps, message: "Running AI evaluation..." });

  const { system, prompt } = buildEvaluateJob(jd);
  const result = await runTask("evaluate_job", { system, prompt });

  await job.updateProgress({ step: 3, total: totalSteps, message: "Writing report..." });

  const { writeReport } = await import("./write-report.mjs");
  const report = await writeReport({
    text: result.text,
    url,
    company,
    role,
    score: parseScore(result.text),
  });

  await job.updateProgress({ step: 4, total: totalSteps, message: "Done" });

  return { report, text: result.text };
}

function parseScore(text) {
  const m = text.match(/---SCORE_SUMMARY---\s*[\s\S]*?SCORE:\s*([\d.]+)/i);
  return m ? parseFloat(m[1]) : null;
}
