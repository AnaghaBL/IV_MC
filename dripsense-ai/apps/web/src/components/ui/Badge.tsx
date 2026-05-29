import { twMerge } from "tailwind-merge";
import clsx from "clsx";

export const Badge = ({ tone = "gray", children, className }: { tone?: "green" | "amber" | "orange" | "red" | "purple" | "gray" | "blue"; children: React.ReactNode; className?: string }) => (
  <span
    className={twMerge(
      clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        tone === "green" && "border-green-200 bg-medical-green-light text-medical-green",
        tone === "amber" && "border-amber-200 bg-medical-amber-light text-medical-amber",
        tone === "orange" && "border-orange-200 bg-orange-50 text-medical-orange",
        tone === "red" && "border-red-200 bg-medical-red-light text-medical-red",
        tone === "purple" && "border-purple-200 bg-purple-50 text-medical-purple dark:bg-purple-950",
        tone === "blue" && "border-blue-200 bg-medical-blue-light text-medical-blue",
        tone === "gray" && "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
      ),
      className
    )}
  >
    {children}
  </span>
);
