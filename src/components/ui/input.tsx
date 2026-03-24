import * as React from "react";
import { cn } from "@/lib/utils";

type InputVariant = "default" | "paper";

const inputClasses: Record<InputVariant, string> = {
  default: "flex h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200",
  paper: "flex h-11 w-full rounded-2xl border border-stone-300 bg-[#f5efe4] px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <input
      ref={ref}
      className={cn(inputClasses[variant], className)}
      {...props}
    />
  )
);
Input.displayName = "Input";
