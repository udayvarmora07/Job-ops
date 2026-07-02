import path from "path";

// The web app lives in <jobops>/web. Data lives one level up.
// Allow an explicit override via JOBOPS_ROOT for flexibility.
export function projectRoot(): string {
  if (process.env.JOBOPS_ROOT) return process.env.JOBOPS_ROOT;
  return path.resolve(process.cwd(), "..");
}

export function dataDir() {
  return path.join(projectRoot(), "data");
}

export function reportsDir() {
  return path.join(projectRoot(), "reports");
}

export const FILES = {
  applications: () => path.join(dataDir(), "applications.md"),
  pipeline: () => path.join(dataDir(), "pipeline.md"),
  scanHistory: () => path.join(dataDir(), "scan-history.tsv"),
  referrals: () => path.join(dataDir(), "referrals.json"),
  profile: () => path.join(projectRoot(), "config", "profile.yml"),
};
