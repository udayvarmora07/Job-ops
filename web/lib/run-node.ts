import { execFile } from "child_process";
import { projectRoot } from "./paths";

/** Run a project .mjs script from the repo root and capture its output. */
export function runNode(
  args: string[],
  opts: { timeout?: number } = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      process.execPath, // the same node binary running Next
      args,
      { cwd: projectRoot(), timeout: opts.timeout ?? 120_000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const code = err && typeof (err as { code?: number }).code === "number"
          ? (err as { code: number }).code
          : err
            ? 1
            : 0;
        resolve({ code, stdout: stdout?.toString() ?? "", stderr: stderr?.toString() ?? "" });
      }
    );
  });
}
