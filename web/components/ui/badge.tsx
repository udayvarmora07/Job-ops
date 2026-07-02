import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-secondary-foreground",
        primary: "border-primary/30 bg-primary/15 text-primary",
        accent: "border-accent/30 bg-accent/15 text-accent",
        success:
          "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]",
        warning:
          "border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]",
        danger:
          "border-[hsl(var(--danger))]/30 bg-[hsl(var(--danger))]/15 text-[hsl(var(--danger))]",
        outline: "border-border text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
