import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runTask } from "../../../../../lib-ai/run.mjs";
import { buildParseResume, parseResumeJson } from "../../../../../lib-ai/tasks/parse-resume.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/profile/parse-resume
 *
 * Accepts:
 * - multipart/form-data with a `file` field (PDF/DOCX/TXT)
 * - application/json with a `text` field (raw resume text)
 *
 * Extracts text from the upload, runs the parse_resume AI task, and returns
 * structured fields to pre-fill the onboarding wizard. Also persists
 * cvMarkdown + cvStructured to the user's UserProfile.
 */
export async function POST(req: Request) {
  const uid = await requireUserId(req);
  if (uid instanceof NextResponse) return uid;

  let resumeText = "";
  let filename = "";

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    // File upload
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    filename = file.name;
    const buffer = Buffer.from(await file.arrayBuffer());

    if (filename.toLowerCase().endsWith(".pdf")) {
      try {
        // pdf-parse v2 exports a PDFParse class (not a callable default).
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        resumeText = result.text;
      } catch (err) {
        console.error("PDF parse failed:", err);
        return NextResponse.json(
          {
            error:
              "We couldn't read that PDF (it may be a scanned image or corrupted). Try pasting the resume text instead.",
          },
          { status: 422 },
        );
      }
    } else if (filename.toLowerCase().endsWith(".docx")) {
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        resumeText = result.value;
      } catch (err) {
        console.error("DOCX parse failed:", err);
        return NextResponse.json(
          {
            error:
              "We couldn't read that DOCX file. Try pasting the resume text instead, or upload a PDF.",
          },
          { status: 422 },
        );
      }
    } else {
      // Assume plain text
      resumeText = buffer.toString("utf8");
    }
  } else {
    // JSON body with raw text
    let body: { text?: string } = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    resumeText = (body.text || "").trim();
  }

  if (resumeText.trim().length < 50) {
    return NextResponse.json(
      { error: "Resume text too short (minimum 50 characters). Please upload a valid resume." },
      { status: 422 },
    );
  }

  // Run the AI parse task
  let rawText: string;
  try {
    const { system, prompt } = buildParseResume(resumeText);
    const r = await runTask("parse_resume", { system, prompt, maxOutputTokens: 8192 });
    rawText = r.text ?? "";
  } catch (err) {
    return NextResponse.json(
      { error: `AI parse failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  const parsed = parseResumeJson(rawText);
  if (!parsed) {
    return NextResponse.json(
      { error: "AI returned invalid JSON. Please try again or paste text manually." },
      { status: 502 },
    );
  }

  // Persist cvMarkdown + cvStructured to the user's profile
  try {
    await prisma.userProfile.update({
      where: { userId: uid },
      data: {
        cvMarkdown: parsed.cvMarkdown || resumeText,
        cvStructured: parsed as object,
      },
    });
  } catch {
    // Profile might not exist yet — create it
    await prisma.userProfile.upsert({
      where: { userId: uid },
      update: {
        cvMarkdown: parsed.cvMarkdown || resumeText,
        cvStructured: parsed as object,
      },
      create: {
        userId: uid,
        cvMarkdown: parsed.cvMarkdown || resumeText,
        cvStructured: parsed as object,
      },
    });
  }

  return NextResponse.json({
    parsed,
    filename,
    cvPersisted: true,
  });
}
