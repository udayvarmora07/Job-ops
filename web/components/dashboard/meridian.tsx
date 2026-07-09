"use client";

/* ————————————————————————————————————————————————————————————————
   Meridian Warm — shared visual primitives.

   Structure from design-samples/web/final.html, colour from concept-a.html.
   Every page composes these so the badges, cards and score treatment read
   identically across Today, Discover, Pipeline, Reports, Resumes, Outreach
   and Settings. Pure presentation — no data fetching.
———————————————————————————————————————————————————————————————— */

import type { ReactNode } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Lock,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

/* Shared keyboard-focus ring — reused on every interactive element so the
   dashboard is fully operable and visibly focusable for keyboard users. */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--amber)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]";

/* ——— Score helpers ——————————————————————————————————————————————— */

export function scoreLabel(n: number): string {
  if (n >= 4.5) return "Exceptional match";
  if (n >= 4.0) return "Strong match";
  if (n >= 3.0) return "Worth a look";
  return "A stretch";
}

/* ——— Ghost Shield ————————————————————————————————————————————————
   Verification state derived from a report's legitimacy tier. Green when
   Playwright-verified active, amber when unconfirmed, red when closed. */
export type ShieldStatus = "verified" | "suspicious" | "closed";

export function ghostShieldFromLegitimacy(legitimacy: string | null): {
  status: ShieldStatus;
  label: string;
} {
  const t = (legitimacy ?? "").toLowerCase();
  if (!t) return { status: "suspicious", label: "Not yet verified" };
  if (/(closed|expired|dead|ghost)/.test(t)) return { status: "closed", label: legitimacy! };
  if (/(suspicious|caution|unconfirmed|unclear|unknown)/.test(t))
    return { status: "suspicious", label: legitimacy! };
  return { status: "verified", label: legitimacy! };
}

export function GhostShield({
  status,
  verifiedAt,
  label,
  compact = false,
}: {
  status: ShieldStatus;
  verifiedAt?: string;
  label?: string;
  compact?: boolean;
}) {
  const map = {
    verified: {
      icon: ShieldCheck,
      text: label ?? (verifiedAt ? `Verified active ${verifiedAt}` : "Verified active"),
      color: "var(--green)",
      bg: "var(--green-dim)",
      border: "rgba(58,201,138,.22)",
    },
    suspicious: {
      icon: ShieldAlert,
      text: label ?? "Unverified",
      color: "var(--amber)",
      bg: "var(--amber-dim)",
      border: "var(--amber-border)",
    },
    closed: {
      icon: ShieldX,
      text: label ?? "Closed",
      color: "var(--red)",
      bg: "var(--red-dim)",
      border: "rgba(224,99,99,.22)",
    },
  } as const;
  const s = map[status];
  const Icon = s.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium"
      style={{ color: s.color, background: s.bg, borderColor: s.border }}
      title={s.text}
    >
      <Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {!compact && <span className="whitespace-nowrap">{s.text}</span>}
    </span>
  );
}

/* ——— Score badge ————————————————————————————————————————————————
   The signature amber grade. Two sizes: inline chip and large numeral. */
export function ScoreBadge({
  score,
  size = "md",
}: {
  score: number | null | undefined;
  size?: "sm" | "md" | "lg";
}) {
  if (score == null) {
    return (
      <span className="text-[color:var(--t3)]" style={{ fontSize: size === "lg" ? 24 : 13 }}>
        —
      </span>
    );
  }
  if (size === "lg") {
    return (
      <span className="font-num inline-flex items-baseline tabular-nums text-[color:var(--amber)]">
        <span style={{ fontSize: 32, lineHeight: 1, fontWeight: 500 }}>{score.toFixed(1)}</span>
        <span className="text-[color:var(--t3)]" style={{ fontSize: 15 }}>
          /5
        </span>
      </span>
    );
  }
  return (
    <span
      className="font-num inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[13px] font-medium tabular-nums"
      style={{
        color: "var(--amber)",
        background: "var(--amber-dim)",
        borderColor: "var(--amber-border)",
      }}
    >
      ★ {score.toFixed(1)}
    </span>
  );
}

/* ——— Salary Intelligence ————————————————————————————————————————
   Salary vs the candidate's target band. Green when at/above target, amber
   when below. Renders nothing loud when a listing carries no comp — the
   Job feed rarely does, so honesty beats a fabricated number. */
export function SalaryBadge({
  salary,
  deltaPct,
}: {
  salary?: string | null;
  deltaPct?: number | null;
}) {
  if (!salary) {
    return <span className="text-[12px] text-[color:var(--t3)]">Salary not listed</span>;
  }
  const above = (deltaPct ?? 0) >= 0;
  return (
    <span className="inline-flex items-center gap-2 text-[12px]">
      <span className="text-[color:var(--t2)]">{salary}</span>
      {deltaPct != null && (
        <span
          className="inline-flex items-center gap-0.5 font-medium"
          style={{ color: above ? "var(--green)" : "var(--amber)" }}
        >
          {above ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {above ? "+" : ""}
          {Math.round(deltaPct)}% target
        </span>
      )}
    </span>
  );
}

/* ——— OSS Privacy badge ——————————————————————————————————————————
   Small reassurance that data stays local. Visible in Discover filters,
   Settings and the footer. */
export function PrivacyBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${className}`}
      style={{ color: "var(--green)", background: "var(--green-dim)", borderColor: "rgba(58,201,138,.22)" }}
      title="Runs locally on your machine — open source, no data leaves your device"
    >
      <Lock className="h-3 w-3" />
      Privacy first · OSS
    </span>
  );
}

/* ——— Card primitives ————————————————————————————————————————————
   The warm card shell from final.html (surface + rule border + radius). */
export function Card({
  children,
  className = "",
  interactive = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[14px] border border-[color:var(--rule)] bg-[color:var(--s1)] ${
        interactive
          ? "transition-colors hover:border-[color:var(--rule-strong)] hover:bg-[color:var(--s2)]"
          : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  label,
  meta,
  icon,
}: {
  label: string;
  meta?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[color:var(--rule)] px-[18px] py-3">
      <span className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-[color:var(--t3)]">
        {icon}
        {label}
      </span>
      {meta && <span className="text-[11px] text-[color:var(--t3)]">{meta}</span>}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-[18px] py-4 ${className}`}>{children}</div>;
}

/* ——— Section title — the small uppercase-free label used across pages ——— */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 text-[11px] font-medium tracking-wide text-[color:var(--t3)]">
      {children}
    </div>
  );
}
