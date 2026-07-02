import type { ReferralStatus } from "@/lib/types";

type Variant =
  | "default"
  | "primary"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "outline";

export function statusVariant(status: string): Variant {
  switch (status.toLowerCase().trim()) {
    case "offer":
      return "success";
    case "interview":
      return "accent";
    case "responded":
      return "primary";
    case "applied":
      return "primary";
    case "evaluated":
      return "outline";
    case "rejected":
      return "danger";
    case "discarded":
    case "skip":
      return "default";
    default:
      return "default";
  }
}

export function legitimacyVariant(v: string | null): Variant {
  if (!v) return "outline";
  const s = v.toLowerCase();
  if (s.includes("high")) return "success";
  if (s.includes("medium") || s.includes("moderate")) return "warning";
  if (s.includes("low") || s.includes("suspect") || s.includes("scam"))
    return "danger";
  return "outline";
}

export const REFERRAL_LABELS: Record<ReferralStatus, string> = {
  to_ask: "To ask",
  asked: "Asked",
  responded: "Responded",
  referred: "Referred",
  declined: "Declined",
};

export function referralVariant(status: ReferralStatus): Variant {
  switch (status) {
    case "referred":
      return "success";
    case "responded":
      return "accent";
    case "asked":
      return "primary";
    case "declined":
      return "danger";
    default:
      return "outline";
  }
}

export function scoreVariant(score: number | null): Variant {
  if (score == null) return "outline";
  if (score >= 4.5) return "success";
  if (score >= 4.0) return "accent";
  if (score >= 3.0) return "warning";
  return "danger";
}
