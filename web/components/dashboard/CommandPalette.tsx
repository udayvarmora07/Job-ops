"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, CornerDownLeft } from "lucide-react";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandPalette({
  commands,
  variant = "button",
}: {
  commands: Command[];
  variant?: "button" | "bar";
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl+K to toggle.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    if (!term) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(term) ||
        c.group.toLowerCase().includes(term) ||
        (c.hint || "").toLowerCase().includes(term)
    );
  }, [q, commands]);

  const groups = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of filtered) {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    }
    return Array.from(map.entries());
  }, [filtered]);

  function runAt(i: number) {
    const cmd = filtered[i];
    if (!cmd) return;
    setOpen(false);
    cmd.run();
  }

  return (
    <>
      {variant === "bar" ? (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full max-w-[380px] items-center gap-2.5 rounded-md border border-[color:var(--rule)] bg-[color:var(--s2)] px-3 py-2 text-[13px] text-[color:var(--t3)] transition-colors hover:border-[color:var(--rule-strong)] cursor-pointer"
          title="Search & run (⌘K)"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search jobs, reports, companies…</span>
          <kbd className="rounded border border-[color:var(--rule)] bg-[color:var(--bg)] px-1.5 py-0.5 font-sans text-[10px]">
            ⌘K
          </kbd>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
          title="Command palette (⌘K)"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search & run…</span>
          <kbd className="rounded border border-border bg-background px-1 font-sans text-[10px]">⌘K</kbd>
        </button>
      )}

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-[18%] z-50 w-[94vw] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                runAt(active);
              }
            }}
          >
            <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                placeholder="Search actions, tasks, pages…"
                className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</p>
              )}
              {groups.map(([group, cmds]) => (
                <div key={group} className="mb-1">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group}
                  </p>
                  {cmds.map((c) => {
                    const idx = filtered.indexOf(c);
                    const isActive = idx === active;
                    return (
                      <button
                        key={c.id}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => runAt(idx)}
                        className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors cursor-pointer ${
                          isActive ? "bg-primary/15 text-foreground" : "hover:bg-secondary/60"
                        }`}
                      >
                        <span className="text-muted-foreground">{c.icon}</span>
                        <span className="flex-1">{c.label}</span>
                        {c.hint && <span className="text-xs text-muted-foreground">{c.hint}</span>}
                        {isActive && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
