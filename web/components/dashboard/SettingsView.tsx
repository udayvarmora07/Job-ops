"use client";

/* ————————————————————————————————————————————————————————————————
   SettingsView — 2-column settings.

   Left: profile + AI key (these live in config/profile.yml / config/ai.yml
   on disk, so the inputs are surfaced for reference and edited there).
   Right: preferences that are genuinely client-side (Ghost Shield
   threshold, scan cadence, momentum) persisted to localStorage, plus the
   OSS privacy assurance.
———————————————————————————————————————————————————————————————— */

import { useEffect, useState } from "react";
import { KeyRound, User, SlidersHorizontal } from "lucide-react";
import { Card, CardHeader, CardBody, PrivacyBadge, focusRing } from "./meridian";
import type { Summary } from "@/lib/types";

interface Prefs {
  ghostThreshold: "off" | "suspicious" | "verified";
  scanFrequency: "manual" | "daily" | "3days" | "weekly";
  momentum: boolean;
}
const DEFAULT_PREFS: Prefs = {
  ghostThreshold: "suspicious",
  scanFrequency: "3days",
  momentum: true,
};
const PREFS_KEY = "jobops.prefs";

function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void] {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);
  const update = (patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  return [prefs, update];
}

const inputCls =
  "w-full rounded-md border border-[color:var(--rule)] bg-[color:var(--s2)] px-3 py-2 text-[13px] text-[color:var(--t1)] placeholder:text-[color:var(--t3)] focus:border-[color:var(--amber-border)] focus:outline-none";
const labelCls = "mb-1.5 block text-[12px] font-medium text-[color:var(--t2)]";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-[color:var(--t3)]">{hint}</p>}
    </div>
  );
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 rounded-full transition-colors ${focusRing}`}
      style={{ background: on ? "var(--amber)" : "var(--s4)" }}
    >
      <span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-[color:var(--bg)] transition-transform"
        style={{ transform: on ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

const selectCls = inputCls + " cursor-pointer appearance-none";

export function SettingsView({ summary }: { summary: Summary | null }) {
  const [prefs, update] = usePrefs();

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-[22px] font-medium tracking-tight text-[color:var(--t1)]">Settings</h2>
        <p className="mt-0.5 text-[13px] text-[color:var(--t2)]">
          Personalise how Jobops scans, verifies and celebrates.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ————— Left column ————— */}
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader label="Profile" icon={<User className="h-3.5 w-3.5" />} />
            <CardBody className="flex flex-col gap-4">
              <Field label="Full name" hint="Edited in config/profile.yml">
                <input className={inputCls} placeholder="Your name" defaultValue="" />
              </Field>
              <Field label="Email">
                <input className={inputCls} placeholder="you@example.com" defaultValue="" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Location">
                  <input className={inputCls} placeholder="City" defaultValue="" />
                </Field>
                <Field label="Timezone">
                  <input className={inputCls} placeholder="UTC+0" defaultValue="" />
                </Field>
              </div>
              <Field label="Target roles" hint="Drives scan keyword filters">
                <input className={inputCls} placeholder="Senior AI Engineer, ML Engineer…" defaultValue="" />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader label="AI provider key" icon={<KeyRound className="h-3.5 w-3.5" />} />
            <CardBody className="flex flex-col gap-4">
              <Field label="API key" hint="Stored in config/ai.yml or your environment — never leaves this machine">
                <input className={inputCls} type="password" placeholder="sk-…" defaultValue="" />
              </Field>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--green)" }} />
                <span className="text-[12px] text-[color:var(--t2)]">
                  Requests run locally through your own key
                </span>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ————— Right column ————— */}
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader label="Preferences" icon={<SlidersHorizontal className="h-3.5 w-3.5" />} />
            <CardBody className="flex flex-col gap-5">
              <Field
                label="Ghost Shield threshold"
                hint="Flag listings below this verification level on job cards"
              >
                <select
                  className={selectCls}
                  value={prefs.ghostThreshold}
                  onChange={(e) => update({ ghostThreshold: e.target.value as Prefs["ghostThreshold"] })}
                >
                  <option value="off">Off — show everything</option>
                  <option value="suspicious">Warn on unverified</option>
                  <option value="verified">Only show verified-active</option>
                </select>
              </Field>

              <Field label="Scan frequency" hint="How often to sweep the portals for new roles">
                <select
                  className={selectCls}
                  value={prefs.scanFrequency}
                  onChange={(e) => update({ scanFrequency: e.target.value as Prefs["scanFrequency"] })}
                >
                  <option value="manual">Manual only</option>
                  <option value="daily">Every day</option>
                  <option value="3days">Every 3 days</option>
                  <option value="weekly">Weekly</option>
                </select>
              </Field>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-medium text-[color:var(--t1)]">
                    Emotional momentum
                  </div>
                  <div className="mt-0.5 text-[11px] text-[color:var(--t3)]">
                    Streak dots, wins feed and confetti
                  </div>
                </div>
                <Toggle on={prefs.momentum} onChange={(v) => update({ momentum: v })} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex flex-col items-start gap-3">
              <PrivacyBadge />
              <p className="text-[12px] leading-relaxed text-[color:var(--t2)]">
                Jobops is open source and runs entirely on your machine. Your CV, applications and
                API keys stay in local files — nothing is uploaded, tracked or sold.
              </p>
              {summary && (
                <p className="text-[11px] text-[color:var(--t3)]">
                  {summary.counts.evaluated} evaluations · {summary.counts.reports} reports stored
                  locally
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
