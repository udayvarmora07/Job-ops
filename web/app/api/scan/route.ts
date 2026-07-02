import { runNode } from "@/lib/run-node";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface ScannerDef {
  id: string;
  label: string;
  args: string[];
  timeout: number;
}

const SCANNERS: ScannerDef[] = [
  { id: "ats",       label: "ATS portals (Greenhouse/Ashby/Lever)", args: ["scan.mjs"],                      timeout: 60_000  },
  { id: "jobspy",    label: "LinkedIn & Indeed",                    args: ["uday-data/scan-jobspy.mjs"],     timeout: 120_000 },
  { id: "remote",    label: "Remote boards (WWR/Remotive/RemoteOK)", args: ["uday-data/scan-remote.mjs"],   timeout: 60_000  },
  { id: "instahyre", label: "Instahyre",                            args: ["uday-data/scan-instahyre.mjs"], timeout: 45_000  },
  { id: "hn",        label: "HN: Who is Hiring",                    args: ["uday-data/scan-hn.mjs"],        timeout: 60_000  },
  { id: "adzuna",    label: "Adzuna",                               args: ["uday-data/scan-adzuna.mjs"],    timeout: 60_000  },
];

function parseNewCount(out: string): number {
  const m = out.match(/New offers added:\s*(\d+)/i);
  return m ? Number(m[1]) : 0;
}

function sse(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST() {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let totalNew = 0;

        for (const scanner of SCANNERS) {
          controller.enqueue(sse({ type: "running", id: scanner.id, label: scanner.label }));

          const { code, stdout, stderr } = await runNode(scanner.args, { timeout: scanner.timeout });
          const out = stdout + "\n" + stderr;
          const newCount = parseNewCount(out);
          totalNew += newCount;

          controller.enqueue(sse({ type: "done", id: scanner.id, new: newCount, ok: code === 0 }));
        }

        controller.enqueue(
          sse({
            type: "complete",
            totalNew,
            summary:
              totalNew > 0
                ? `${totalNew} new job${totalNew === 1 ? "" : "s"} found`
                : "Scan complete — no new jobs found",
          })
        );
      } catch (err) {
        controller.enqueue(sse({ type: "error", message: String(err) }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
