"use client";

import { motion } from "framer-motion";
import { ExternalLink, MapPin, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportDialog } from "./ReportDialog";
import { scoreVariant, legitimacyVariant } from "./status";
import type { ReportMeta } from "@/lib/types";

export function ReportsView({
  reports,
  loading,
}: {
  reports: ReportMeta[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        No evaluation reports yet.
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {reports.map((r, i) => (
        <motion.div
          key={r.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.03 }}
        >
          <Card className="flex h-full flex-col transition-colors hover:border-primary/40">
            <CardContent className="flex flex-1 flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">#{r.id} · {r.date}</p>
                  <h3 className="mt-0.5 font-semibold leading-tight">{r.company}</h3>
                  <p className="text-sm text-muted-foreground">{r.role}</p>
                </div>
                {r.score && (
                  <Badge variant={scoreVariant(r.scoreNum)}>{r.score}</Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {r.legitimacy && (
                  <Badge variant={legitimacyVariant(r.legitimacy)}>
                    {r.legitimacy}
                  </Badge>
                )}
                {r.archetype && (
                  <Badge variant="outline">{r.archetype.split("—")[0].trim()}</Badge>
                )}
              </div>

              {r.location && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {r.location}
                </p>
              )}

              <div className="mt-auto flex items-center gap-2 pt-1">
                <ReportDialog
                  reportId={r.id}
                  trigger={
                    <Button variant="secondary" size="sm">
                      <BookOpen className="h-3.5 w-3.5" />
                      Read report
                    </Button>
                  }
                />
                {r.url && (
                  <Button variant="ghost" size="icon" asChild>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open posting"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
