import { Suspense } from "react";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

export const metadata = { title: "Onboarding — Jobops" };

export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Suspense>
        <OnboardingWizard />
      </Suspense>
    </main>
  );
}
