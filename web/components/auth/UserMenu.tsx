"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, UserCog } from "lucide-react";
import { createClient, SUPABASE_ENABLED } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Shows the signed-in user's email and a sign-out button. Renders nothing when
 * Supabase auth is disabled or no user is present, so the dashboard stays clean
 * in local/dev.
 */
export function UserMenu() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!SUPABASE_ENABLED) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  if (!SUPABASE_ENABLED || !email) return null;

  return (
    <div className="flex items-center gap-2">
      <span
        className="hidden max-w-[16ch] truncate text-xs text-muted-foreground sm:inline"
        title={email}
      >
        {email}
      </span>
      <Button variant="outline" size="sm" asChild title="Profile & settings">
        <Link href="/settings">
          <UserCog className="h-4 w-4" />
          <span className="hidden sm:inline">Profile</span>
        </Link>
      </Button>
      <form action="/auth/signout" method="post">
        <Button variant="outline" size="sm" type="submit" title="Sign out">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </form>
    </div>
  );
}
