import * as React from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "paper" | "console" | "muted";

const cardClasses: Record<CardVariant, string> = {
  default: "rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-sm",
  paper: "rounded-[24px] border border-stone-300 bg-[#fcfaf6] text-slate-950 shadow-[0_14px_34px_rgba(41,37,36,0.07)]",
  console: "rounded-[24px] border border-slate-800 bg-[#1f2933] text-stone-100 shadow-[0_18px_40px_rgba(31,41,51,0.22)]",
  muted: "rounded-[24px] border border-stone-300 bg-[#f5efe4] text-slate-950 shadow-[0_10px_24px_rgba(41,37,36,0.05)]"
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div ref={ref} className={cn(cardClasses[variant], className)} {...props} />
  )
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex flex-col space-y-1.5 p-5", className)} {...props} />
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => <h3 ref={ref} className={cn("font-semibold leading-none tracking-tight", className)} {...props} />
);
CardTitle.displayName = "CardTitle";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
);
CardContent.displayName = "CardContent";
