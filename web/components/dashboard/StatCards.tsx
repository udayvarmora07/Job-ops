"use client";

import { motion } from "framer-motion";
import {
  Database,
  Inbox,
  ClipboardCheck,
  SendHorizonal,
  Trophy,
  Star,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Summary } from "@/lib/types";

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  index,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: "easeOut" }}
    >
      <Card className="p-4 transition-colors hover:border-primary/40">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="font-num mt-1 text-2xl font-medium">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-md"
            style={{ background: `${accent}1f`, color: accent }}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function StatCards({
  summary,
  loading,
}: {
  summary: Summary | null;
  loading: boolean;
}) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[86px]" />
        ))}
      </div>
    );
  }
  const c = summary.counts;
  // Warm Meridian accents only — paper for neutral counts, amber for
  // achievement, green for success. No navy/indigo.
  const items = [
    { icon: Database, label: "Fetched jobs", value: c.fetchedJobs, sub: "scanned + inbox", accent: "#A09880" },
    { icon: Inbox, label: "In pipeline", value: c.inPipeline, sub: "pending eval", accent: "#A09880" },
    { icon: ClipboardCheck, label: "Evaluated", value: c.evaluated, sub: `${c.reports} reports`, accent: "#C8920A" },
    { icon: SendHorizonal, label: "Applied", value: summary.funnel[1]?.count ?? 0, sub: `${summary.rates.response}% response`, accent: "#C8920A" },
    { icon: Trophy, label: "Offers", value: summary.funnel[4]?.count ?? 0, sub: `${summary.rates.offer}% rate`, accent: "#3AC98A" },
    { icon: Star, label: "Avg score", value: summary.avgScore != null ? summary.avgScore.toFixed(1) : "—", sub: "of evaluated", accent: "#C8920A" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((it, i) => (
        <Stat key={it.label} index={i} {...it} />
      ))}
    </div>
  );
}
