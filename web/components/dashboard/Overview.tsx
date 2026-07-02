"use client";

import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { statusVariant } from "./status";
import type { Summary } from "@/lib/types";

const FUNNEL_COLORS = ["#475569", "#3B82F6", "#6366F1", "#F59E0B", "#22C55E"];

function Rate({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-num mt-1 text-3xl font-semibold text-foreground">
        {value}
        <span className="text-base text-muted-foreground">%</span>
      </p>
    </div>
  );
}

export function Overview({
  summary,
  loading,
}: {
  summary: Summary | null;
  loading: boolean;
}) {
  if (loading || !summary) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const data = summary.funnel.map((f, i) => ({
    ...f,
    fill: FUNNEL_COLORS[i] || "#475569",
  }));
  const statusEntries = Object.entries(summary.byStatus).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Pipeline funnel</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.counts.evaluated === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No applications evaluated yet. Evaluate a job to start the funnel.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={data}
                  margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={84}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#94A3B8", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(148,163,184,0.08)" }}
                    contentStyle={{
                      background: "#0B1220",
                      border: "1px solid #1E293B",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number, _n, p: any) => [
                      `${v} (${p.payload.pct}%)`,
                      "Count",
                    ]}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={26}>
                    {data.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversion rates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Rate label="Response" value={summary.rates.response} />
            <Rate label="Interview" value={summary.rates.interview} />
            <Rate label="Offer" value={summary.rates.offer} />
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-4">
            <p className="mb-2 text-xs text-muted-foreground">By status</p>
            {statusEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {statusEntries.map(([status, n]) => (
                  <motion.div
                    key={status}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Badge variant={statusVariant(status)}>
                      {status}
                      <span className="font-num ml-1 opacity-80">{n}</span>
                    </Badge>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
