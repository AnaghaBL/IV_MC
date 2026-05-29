import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

export const Button = ({ children, className, variant = "secondary", ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>) => (
  <button
    className={twMerge(
      clsx(
        "focusable inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-medical-blue text-white hover:bg-blue-800",
        variant === "secondary" && "border border-medical-border bg-white text-medical-gray hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
        variant === "ghost" && "text-medical-gray hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
        variant === "destructive" && "bg-medical-red text-white hover:bg-red-700"
      ),
      className
    )}
    {...props}
  >
    {children}
  </button>
);
