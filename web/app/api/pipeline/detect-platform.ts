export function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("linkedin.com")) return "linkedin";
  if (u.includes("naukri.com")) return "naukri";
  if (u.includes("indeed.com")) return "indeed";
  if (u.includes("glassdoor.com")) return "glassdoor";
  if (u.includes("wellfound.com") || u.includes("angel.co")) return "wellfound";
  if (u.includes("instahyre.com")) return "instahyre";
  if (u.includes("cutshort.io")) return "cutshort";
  if (u.includes("hirist.tech")) return "hirist";
  if (u.includes("foundit.in")) return "foundit";
  if (u.includes("iimjobs.com")) return "iimjobs";
  if (u.includes("shine.com")) return "shine";
  return "manual";
}
