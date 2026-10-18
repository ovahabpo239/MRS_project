import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  error: "border-error/40 bg-error-container/20 text-error",
  success: "border-secondary/40 bg-secondary/10 text-secondary",
  info: "border-primary/30 bg-primary/5 text-primary",
} as const;

/** Errors are announced immediately (role=alert); other tones politely (role=status). */
export function Alert({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-lg border px-4 py-3 font-body-md text-body-md", tones[tone])}
    >
      {children}
    </div>
  );
}
