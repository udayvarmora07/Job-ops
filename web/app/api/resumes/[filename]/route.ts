import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { projectRoot } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFilename(filename: string): boolean {
  return /^[a-zA-Z0-9_\-.]+\.pdf$/.test(filename);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  if (!safeFilename(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(projectRoot(), "output/resumes", filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdf = fs.readFileSync(filePath);
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  if (!safeFilename(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const dir = path.join(projectRoot(), "output/resumes");
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  fs.unlinkSync(filePath);
  // Also delete the sidecar if it exists
  const metaPath = filePath.replace(/\.pdf$/, ".meta.json");
  if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);

  return NextResponse.json({ ok: true });
}
