import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/profile/status — lightweight onboarding gate check.
 * Returns { essentialsComplete, onboardingComplete } for the caller.
 * Used by the middleware gate and the mobile app's onboarding redirect.
 */
export async function GET(req: Request) {
  const uid = await getUserId(req);
  if (!uid) {
    return NextResponse.json(
      { essentialsComplete: false, onboardingComplete: false },
      { status: 401 },
    );
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: uid },
    select: {
      essentialsComplete: true,
      onboardingComplete: true,
    },
  });

  return NextResponse.json({
    essentialsComplete: profile?.essentialsComplete ?? false,
    onboardingComplete: profile?.onboardingComplete ?? false,
  });
}
