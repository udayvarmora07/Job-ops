import Link from "next/link";

export default function AuthCodeError() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          Sign-in failed
        </h1>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t complete the sign-in. The link may have expired or
          already been used. Please try again.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
