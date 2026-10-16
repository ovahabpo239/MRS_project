import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "rounded-full bg-surface-container-highest px-3 py-1 font-code-sm text-[10px] uppercase text-secondary",
        className,
      )}
      {...props}
    />
  );
}
