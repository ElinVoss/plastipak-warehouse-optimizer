import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "secondary" | "console" | "accent" | "ghost-light" | "danger-soft";
type ButtonSize = "default" | "sm" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-slate-900 text-white hover:bg-slate-800",
  outline: "border border-stone-300 bg-[#fcfaf6] text-stone-800 hover:bg-stone-100",
  secondary: "bg-[#f5efe4] text-stone-800 hover:bg-[#ece3d4]",
  console: "border border-slate-800 bg-[#1f2933] text-stone-100 hover:bg-[#2a3641] shadow-[0_12px_24px_rgba(31,41,51,0.18)]",
  accent: "border border-amber-700 bg-[#d97706] text-white hover:bg-[#b85f05] shadow-[0_12px_24px_rgba(217,119,6,0.2)]",
  "ghost-light": "border border-white/10 bg-transparent text-stone-200 hover:bg-white/5",
  "danger-soft": "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-xl px-3",
  lg: "h-11 px-5 py-2.5"
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
