"use client";

/* A dependency-free confetti burst. Fires whenever `trigger` increments —
   used to celebrate an application reaching the Interview stage. Respects
   prefers-reduced-motion. */

import { useEffect, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";

const COLORS = ["var(--amber)", "var(--green)", "var(--t1)", "var(--red)"];

export function Confetti({ trigger }: { trigger: number }) {
  const reduce = useReducedMotion();
  const [burst, setBurst] = useState<number>(0);

  useEffect(() => {
    if (trigger > 0) setBurst(trigger);
  }, [trigger]);

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(0), 1400);
    return () => clearTimeout(t);
  }, [burst]);

  if (reduce || !burst) return null;

  const pieces = Array.from({ length: 36 }, (_, i) => i);

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center">
      <AnimatePresence>
        {pieces.map((i) => {
          const angle = (i / pieces.length) * Math.PI * 2;
          const dist = 120 + Math.random() * 220;
          const x = Math.cos(angle) * dist;
          const y = Math.sin(angle) * dist - 60;
          return (
            <motion.span
              key={`${burst}-${i}`}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
              animate={{ x, y: y + 340, opacity: 0, rotate: Math.random() * 720 - 360, scale: 0.6 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute h-2 w-2 rounded-[1px]"
              style={{ background: COLORS[i % COLORS.length] }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
