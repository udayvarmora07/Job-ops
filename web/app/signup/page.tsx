import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Sign up — Jobops" };

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </main>
  );
}
