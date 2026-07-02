import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { addOutreach, updateOutreach } from "../../../../../lib-outreach/index.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FOLLOWUP_DAYS = 6;

function followUpDate() {
  const d = new Date();
  d.setDate(d.getDate() + FOLLOWUP_DAYS);
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * POST /api/outreach/send
 *
 * Sends a cold email via Gmail SMTP (Nodemailer + App Password) and logs it
 * in data/outreach.json as status "sent" with sentDate + followUpDate.
 *
 * Required env vars:
 *   GMAIL_USER          — sender address (e.g. you@gmail.com)
 *   GMAIL_APP_PASSWORD  — 16-char Google App Password (not your account password)
 *
 * Body:
 *   to            string  — recipient email
 *   subject       string  — email subject
 *   body          string  — plain-text email body
 *   company       string  — for tracking
 *   role?         string  — for tracking
 *   personName?   string  — contact's name
 *   personTitle?  string  — contact's title
 *   mode?         "jd_specific"|"speculative"
 *   emailSource?  string  — source of the address (hunter-indexed, etc.)
 *   verification? string  — verification status
 *   domain?       string  — company domain
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const { to, subject, body: emailBody, company } = body as {
    to: string;
    subject: string;
    body: string;
    company: string;
  };

  if (!to || !subject || !emailBody || !company) {
    return NextResponse.json(
      { error: "to, subject, body, and company are required" },
      { status: 400 }
    );
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    return NextResponse.json(
      {
        error:
          "GMAIL_USER and GMAIL_APP_PASSWORD are not set. Add them to your .env file — see .env.example for instructions.",
      },
      { status: 503 }
    );
  }

  // Send via Gmail SMTP.
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPass },
  });

  let messageId: string;
  try {
    const info = await transporter.sendMail({
      from: `Uday Varmora <${gmailUser}>`,
      to,
      subject,
      text: emailBody,
    });
    messageId = info.messageId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Send failed: ${msg}` }, { status: 502 });
  }

  // Log in outreach store. addOutreach deduplicates by email, so a second
  // send to the same address updates the existing record.
  const today = todayISO();
  const fup = followUpDate();

  const existing = (await import("../../../../../lib-outreach/index.mjs")).findByEmail(to);

  let record;
  if (existing) {
    record = updateOutreach(existing.id, {
      status: "sent",
      sentDate: today,
      followUpDate: fup,
      subject,
      mode: body.mode || existing.mode,
      note: body.personName ? `Sent to ${body.personName}` : undefined,
    });
  } else {
    record = addOutreach({
      company,
      role: body.role || "",
      domain: body.domain || "",
      contactName: body.personName || "",
      contactTitle: body.personTitle || "",
      email: to,
      emailSource: body.emailSource || "",
      verification: body.verification || "",
      mode: body.mode || "speculative",
      subject,
      status: "sent",
      sentDate: today,
      followUpDate: fup,
    });
  }

  return NextResponse.json({
    ok: true,
    messageId,
    outreachId: record?.id,
    sentDate: today,
    followUpDate: fup,
  });
}
