import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fields the wizard can save, grouped loosely. All optional except we track
 * essentials (name + target roles + location) for the onboarding gate.
 */
interface ProfileUpdate {
  fullName?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  timezone?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;

  employmentStatus?: string;
  availability?: string;
  visaStatus?: string;
  onsiteAvailability?: string;

  targetRoles?: string[];
  archetypes?: unknown;
  superpowers?: string[];
  proofPoints?: unknown;

  compTargetRange?: string;
  compCurrency?: string;
  compMinimum?: string;
  compFlexibility?: string;

  pastCompanies?: string[];
  schools?: string[];

  cvMarkdown?: string;
  cvStructured?: unknown;

  scanKeywords?: string[];
  targetCompanies?: string[];

  onboardingComplete?: boolean;
}

/** Essentials = name + at least one target role + location (city or country). */
function hasEssentials(d: Partial<ProfileUpdate>): boolean {
  return Boolean(
    d.fullName?.trim() &&
      (d.targetRoles?.length ?? 0) > 0 &&
      (d.city?.trim() || d.country?.trim()),
  );
}

/**
 * Best-effort name/email from the Supabase user (bearer token from mobile, or
 * the SSR cookie session on web). Used to seed a freshly-created profile.
 */
async function getSupabaseIdentity(
  req: Request,
): Promise<{ email: string | null; name: string | null }> {
  const SUPABASE_ENABLED = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (!SUPABASE_ENABLED) return { email: null, name: null };
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();
      const resp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
      });
      if (resp.ok) {
        const u = await resp.json();
        return {
          email: u?.email ?? null,
          name: u?.user_metadata?.name ?? u?.user_metadata?.full_name ?? null,
        };
      }
      return { email: null, name: null };
    }
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return {
      email: user?.email ?? null,
      name:
        (user?.user_metadata?.name as string) ??
        (user?.user_metadata?.full_name as string) ??
        null,
    };
  } catch {
    return { email: null, name: null };
  }
}

/**
 * GET /api/profile — the caller's profile, auto-creating an empty row (seeded
 * with their Supabase email/name) on first hit. The wizard loads this to
 * prefill, and it guarantees the row exists before any PUT.
 */
export async function GET(req: Request) {
  const uid = await requireUserId(req);
  if (uid instanceof NextResponse) return uid;

  let profile = await prisma.userProfile.findUnique({ where: { userId: uid } });
  if (!profile) {
    const { email, name } = await getSupabaseIdentity(req);
    profile = await prisma.userProfile.create({
      data: {
        userId: uid,
        email: email ?? undefined,
        fullName: name ?? undefined,
      },
    });
  }

  return NextResponse.json({ profile });
}

/**
 * PUT /api/profile — partial update. Each wizard step saves as-you-go.
 * Sets essentialsComplete once name + target roles + location are present.
 */
export async function PUT(req: Request) {
  const uid = await requireUserId(req);
  if (uid instanceof NextResponse) return uid;

  let body: ProfileUpdate = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  // Build the update payload — only accept known keys, preserve undefined as
  // "not provided" (don't erase). Null explicitly clears a field.
  const data: Record<string, unknown> = {};

  const stringFields: (keyof ProfileUpdate)[] = [
    "fullName", "email", "phone", "city", "country", "timezone",
    "linkedinUrl", "githubUrl", "portfolioUrl",
    "employmentStatus", "availability", "visaStatus", "onsiteAvailability",
    "compTargetRange", "compCurrency", "compMinimum", "compFlexibility",
  ];
  for (const f of stringFields) {
    if (f in body) data[f] = body[f] ?? null;
  }

  const arrayFields: (keyof ProfileUpdate)[] = [
    "targetRoles", "superpowers", "pastCompanies", "schools",
    "scanKeywords", "targetCompanies",
  ];
  for (const f of arrayFields) {
    if (f in body) {
      const val = body[f];
      data[f] = Array.isArray(val) ? val : val === null ? [] : [];
    }
  }

  const jsonFields: (keyof ProfileUpdate)[] = [
    "archetypes", "proofPoints", "cvStructured",
  ];
  for (const f of jsonFields) {
    if (f in body) data[f] = body[f] as object;
  }

  if ("cvMarkdown" in body) data.cvMarkdown = body.cvMarkdown ?? null;
  if ("onboardingComplete" in body) data.onboardingComplete = !!body.onboardingComplete;

  // Merge with existing to check essentials (since PUT is partial).
  const existing = await prisma.userProfile.findUnique({ where: { userId: uid } });
  if (!existing) {
    // Shouldn't happen (GET auto-creates) but handle gracefully.
    return NextResponse.json(
      { error: "Profile not found. Call GET /api/profile first." },
      { status: 404 },
    );
  }

  const merged: Partial<ProfileUpdate> = {
    fullName: (data.fullName as string) ?? existing.fullName ?? undefined,
    targetRoles: (data.targetRoles as string[]) ?? existing.targetRoles ?? undefined,
    city: (data.city as string) ?? existing.city ?? undefined,
    country: (data.country as string) ?? existing.country ?? undefined,
  };

  data.essentialsComplete = hasEssentials(merged);

  // Seed email/name from Supabase if the user hasn't provided them yet.
  if (!existing.email || !existing.fullName) {
    const SUPABASE_ENABLED = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
    if (SUPABASE_ENABLED) {
      try {
        let seedEmail: string | null = null;
        let seedName: string | null = null;
        const authHeader = req.headers.get("authorization");
        if (authHeader?.toLowerCase().startsWith("bearer ")) {
          const token = authHeader.slice(7).trim();
          const resp = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              },
            },
          );
          if (resp.ok) {
            const u = await resp.json();
            seedEmail = u?.email ?? null;
            seedName = u?.user_metadata?.name ?? u?.user_metadata?.full_name ?? null;
          }
        } else {
          const supabase = await createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          seedEmail = user?.email ?? null;
          seedName =
            (user?.user_metadata?.name as string) ??
            (user?.user_metadata?.full_name as string) ??
            null;
        }
        if (seedEmail && !existing.email && !("email" in body)) data.email = seedEmail;
        if (seedName && !existing.fullName && !("fullName" in body)) data.fullName = seedName;
      } catch {
        /* best-effort */
      }
    }
  }

  const profile = await prisma.userProfile.update({
    where: { userId: uid },
    data,
  });

  return NextResponse.json({ profile });
}
