import { NextRequest, NextResponse } from "next/server";
import {
  listOutreach,
  addOutreach,
  updateOutreach,
  deleteOutreach,
  templateStats,
} from "../../../../lib-outreach/index.mjs";

// File-system access + the lib-outreach engine need the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/outreach → all tracked records + per-template A/B stats. */
export async function GET() {
  const outreach = listOutreach();
  return NextResponse.json({ outreach, templateStats: templateStats(outreach) });
}

/** POST /api/outreach → log (or merge by email) an outreach record. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.company && !body.email) {
    return NextResponse.json({ error: "company or email required" }, { status: 400 });
  }
  const record = addOutreach(body);
  return NextResponse.json({ record });
}

/** PATCH /api/outreach → update a record by id (e.g. status change). */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const record = updateOutreach(body.id, body.patch || body);
  if (!record) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ record });
}

/** DELETE /api/outreach → permanently remove a record by id. */
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = body.id || new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const ok = deleteOutreach(id);
  if (!ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
