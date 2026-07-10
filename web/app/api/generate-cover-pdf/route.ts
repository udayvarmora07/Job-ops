import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { projectRoot } from "@/lib/paths";
import { runNode } from "@/lib/run-node";
import { withErrorJson } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtmlParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block
        .split("\n")
        .map((l) => escapeHtml(l.trim()))
        .filter(Boolean)
        .join("<br>");
      return lines ? `<p>${lines}</p>` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function buildCoverHtml(text: string): string {
  const body = textToHtmlParagraphs(text);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Calibri, Carlito, 'Liberation Sans', Arial, sans-serif;
    font-size: 10.5pt;
    color: #111;
    background: #fff;
    padding: 0.85in 0.75in;
    line-height: 1.45;
  }
  .name {
    font-size: 16pt;
    font-weight: bold;
    text-align: center;
    color: #1B3A6B;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 5pt;
  }
  .contact {
    font-size: 9pt;
    text-align: center;
    color: #444;
    margin-bottom: 9pt;
  }
  .contact a { color: #444; text-decoration: none; }
  .divider {
    border: none;
    border-top: 1.5pt solid #1B3A6B;
    margin-bottom: 18pt;
  }
  .body p {
    margin-bottom: 10pt;
    text-align: justify;
  }
</style>
</head>
<body>
  <p class="name">UDAY VARMORA</p>
  <p class="contact">
    +91 96623 85170 &nbsp;&middot;&nbsp; varmorauday1045@gmail.com &nbsp;&middot;&nbsp;
    linkedin.com/in/udayvarmora &nbsp;&middot;&nbsp; github.com/udayvarmora07 &nbsp;&middot;&nbsp; Ahmedabad, India
  </p>
  <hr class="divider">
  <div class="body">
    ${body}
  </div>
</body>
</html>`;
}

async function coverPdfHandler(req: Request) {
  let body: { text?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const text = (body.text || "").trim();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

  const root = projectRoot();
  const ts = Date.now();
  // Write temp files inside the project (gitignored output/) — generate-pdf.mjs
  // refuses to write a PDF outside the project root, so OS temp dirs (/tmp) fail.
  const tmpDir = path.join(root, "output", "tmp");
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpHtml = path.join(tmpDir, `cover-${ts}.html`);
  const tmpPdf = path.join(tmpDir, `cover-${ts}.pdf`);

  try {
    fs.writeFileSync(tmpHtml, buildCoverHtml(text), "utf8");

    const result = await runNode(
      ["generate-pdf.mjs", tmpHtml, tmpPdf, "--format=letter"],
      { timeout: 60_000 }
    );

    if (result.code !== 0) {
      return NextResponse.json(
        { error: `PDF render failed (exit ${result.code})`, stderr: result.stderr },
        { status: 500 }
      );
    }

    if (!fs.existsSync(tmpPdf)) {
      return NextResponse.json(
        { error: "PDF was not produced", stdout: result.stdout },
        { status: 500 }
      );
    }

    const pdf = fs.readFileSync(tmpPdf);
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Cover_Letter_Uday_Varmora.pdf"',
      },
    });
  } finally {
    try { fs.unlinkSync(tmpHtml); } catch { /* */ }
    try { fs.unlinkSync(tmpPdf); } catch { /* */ }
  }
}

export const POST = withErrorJson(coverPdfHandler);
