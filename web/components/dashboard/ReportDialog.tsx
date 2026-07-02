"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ReportMeta } from "@/lib/types";

export function ReportDialog({
  reportId,
  trigger,
}: {
  reportId: string;
  trigger?: React.ReactNode;
}) {
  const [body, setBody] = useState<string | null>(null);
  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(open: boolean) {
    if (!open || body) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${reportId}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setBody(data.body);
        setMeta(data.meta);
      } else {
        setBody("Report not found.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog onOpenChange={load}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm">
            <FileText className="h-3.5 w-3.5" />
            Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <div className="border-b border-border px-5 py-3">
          <DialogTitle className="text-sm font-semibold">
            {meta?.title || `Report ${reportId}`}
          </DialogTitle>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="report-md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {body || ""}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
