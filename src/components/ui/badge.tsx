import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "outline" | "secondary" | "console" | "success" | "warning";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-slate-900 text-white",
  outline: "border border-stone-300 bg-[#fcfaf6] text-stone-700",
  secondary: "bg-stone-100 text-stone-700",
  console: "border border-white/15 bg-white text-stone-900",
  success: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border border-amber-200 bg-amber-50 text-amber-800"
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
