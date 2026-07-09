"use client";

/* ————————————————————————————————————————————————————————————————
   AppShell — the Meridian Warm frame.

   Structure lifted from design-samples/web/final.html: a collapsible
   sidebar, a topbar with search + primary actions, a scrollable content
   well, and a corner watermark. Presentation only — all state and data
   live in Dashboard and flow in through props.
———————————————————————————————————————————————————————————————— */

import { useState, type ReactNode } from "react";
import { Menu, Bell, Radar, Sparkles, Loader2 } from "lucide-react";
import { CommandPalette, type Command } from "./CommandPalette";
import { PrivacyBadge, focusRing } from "./meridian";

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}
export interface NavSection {
  title?: string;
  items: NavItem[];
}

export function AppShell({
  sections,
  active,
  onSelect,
  commands,
  onScan,
  scanning,
  onEvaluate,
  user,
  children,
}: {
  sections: NavSection[];
  active: string;
  onSelect: (id: string) => void;
  commands: Command[];
  onScan: () => void;
  scanning: boolean;
  onEvaluate: () => void;
  user: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const activeItem = sections.flatMap((s) => s.items).find((i) => i.id === active);

  return (
    <div className="flex h-screen overflow-hidden bg-[color:var(--bg)] text-[color:var(--t1)]">
      {/* ————————————————— Sidebar ————————————————— */}
      <aside
        className="flex flex-shrink-0 flex-col overflow-hidden border-r border-[color:var(--rule)] bg-[color:var(--s1)] transition-[width] duration-200"
        style={{ width: collapsed ? 58 : 224 }}
      >
        <div className="flex h-[54px] flex-shrink-0 items-center gap-2.5 border-b border-[color:var(--rule)] px-3.5">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[14px] font-medium text-[color:var(--bg)]"
            style={{ background: "var(--amber)" }}
          >
            J
          </div>
          {!collapsed && (
            <span className="whitespace-nowrap text-[15px] font-medium tracking-tight text-[color:var(--t1)]">
              Jobops
            </span>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-px overflow-y-auto p-2">
          {sections.map((section, si) => (
            <div key={si} className="flex flex-col gap-px">
              {section.title && !collapsed && (
                <div className="whitespace-nowrap px-2.5 pb-1 pt-3 text-[10px] font-medium tracking-wide text-[color:var(--t3)]">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const isActive = item.id === active;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={`relative flex w-full items-center gap-2.5 overflow-hidden rounded-md px-2.5 py-2 text-left text-[13px] font-medium transition-colors ${focusRing} ${
                      isActive
                        ? "text-[color:var(--amber)]"
                        : "text-[color:var(--t2)] hover:bg-[color:var(--s2)] hover:text-[color:var(--t1)]"
                    }`}
                    style={isActive ? { background: "var(--amber-dim)" } : undefined}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 h-3/5 w-[3px] -translate-y-1/2 rounded-r"
                        style={{ background: "var(--amber)" }}
                      />
                    )}
                    <span className="flex-shrink-0">{item.icon}</span>
                    {!collapsed && <span className="flex-1 whitespace-nowrap">{item.label}</span>}
                    {!collapsed && item.badge != null && item.badge > 0 && (
                      <span
                        className="font-num flex-shrink-0 rounded-full px-1.5 text-[10px] font-medium tabular-nums"
                        style={{ background: "var(--amber-dim)", color: "var(--amber)" }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-[color:var(--rule)] p-2">{user}</div>
      </aside>

      {/* ————————————————— Main ————————————————— */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[54px] flex-shrink-0 items-center gap-3 border-b border-[color:var(--rule)] bg-[color:var(--s1)] px-4 sm:px-6">
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle sidebar"
            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[color:var(--rule)] text-[color:var(--t2)] transition-colors hover:bg-[color:var(--s2)] hover:text-[color:var(--t1)] cursor-pointer ${focusRing}`}
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="hidden flex-1 sm:block">
            <CommandPalette commands={commands} variant="bar" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              aria-label="Notifications"
              className={`relative flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--rule)] text-[color:var(--t2)] transition-colors hover:bg-[color:var(--s2)] hover:text-[color:var(--t1)] cursor-pointer ${focusRing}`}
            >
              <Bell className="h-4 w-4" />
              <span
                className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--amber)", boxShadow: "0 0 0 2px var(--s1)" }}
              />
            </button>
            <button
              onClick={onScan}
              disabled={scanning}
              className={`inline-flex items-center gap-1.5 rounded-md border border-[color:var(--rule)] px-3 py-1.5 text-[13px] font-medium text-[color:var(--t2)] transition-colors hover:bg-[color:var(--s2)] hover:text-[color:var(--t1)] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer ${focusRing}`}
            >
              {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />}
              <span className="hidden md:inline">{scanning ? "Scanning…" : "Scan portals"}</span>
            </button>
            <button
              onClick={onEvaluate}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-[color:var(--bg)] transition-opacity hover:opacity-90 cursor-pointer ${focusRing}`}
              style={{ background: "var(--amber)" }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Evaluate job</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-7 sm:px-8">
            <div className="mb-6 sm:hidden">
              <CommandPalette commands={commands} variant="bar" />
            </div>
            {/* Section title for the active page (accessible landmark) */}
            <h1 className="sr-only">{activeItem?.label ?? "Jobops"}</h1>
            {children}
          </div>
        </main>
      </div>

      {/* ————————————————— Watermark / OSS badge ————————————————— */}
      <div className="pointer-events-auto fixed bottom-4 right-5 z-40 hidden lg:block">
        <PrivacyBadge />
      </div>
    </div>
  );
}
