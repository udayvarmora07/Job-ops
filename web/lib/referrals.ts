import fs from "fs";
import { FILES } from "./paths";

export type ReferralStatus =
  | "to_ask"
  | "asked"
  | "responded"
  | "referred"
  | "declined";

export const REFERRAL_STATUSES: ReferralStatus[] = [
  "to_ask",
  "asked",
  "responded",
  "referred",
  "declined",
];

export interface Referral {
  id: string;
  company: string;
  role: string;
  contact: string;
  channel: string; // LinkedIn, email, mutual, etc.
  status: ReferralStatus;
  jobUrl: string;
  note: string;
  askedDate: string | null;
  updatedAt: string;
}

function read(): Referral[] {
  try {
    const raw = fs.readFileSync(FILES.referrals(), "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function write(items: Referral[]) {
  fs.writeFileSync(FILES.referrals(), JSON.stringify(items, null, 2) + "\n", "utf8");
}

export function listReferrals(): Referral[] {
  return read();
}

export function upsertReferral(input: Partial<Referral>): Referral {
  const items = read();
  const now = new Date().toISOString();
  if (input.id) {
    const idx = items.findIndex((r) => r.id === input.id);
    if (idx >= 0) {
      const wasAsked = items[idx].status === "to_ask";
      items[idx] = { ...items[idx], ...input, updatedAt: now } as Referral;
      if (wasAsked && items[idx].status !== "to_ask" && !items[idx].askedDate) {
        items[idx].askedDate = now.slice(0, 10);
      }
      write(items);
      return items[idx];
    }
  }
  const ref: Referral = {
    id: input.id || `ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    company: input.company || "",
    role: input.role || "",
    contact: input.contact || "",
    channel: input.channel || "LinkedIn",
    status: (input.status as ReferralStatus) || "to_ask",
    jobUrl: input.jobUrl || "",
    note: input.note || "",
    askedDate: input.askedDate || (input.status && input.status !== "to_ask" ? now.slice(0, 10) : null),
    updatedAt: now,
  };
  items.push(ref);
  write(items);
  return ref;
}

export function deleteReferral(id: string): boolean {
  const items = read();
  const next = items.filter((r) => r.id !== id);
  if (next.length === items.length) return false;
  write(next);
  return true;
}
