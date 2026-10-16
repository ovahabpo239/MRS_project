import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const base =
  "inline-flex items-center justify-center gap-2 font-label-caps text-label-caps transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50";

const variants = {
  shimmer: "shimmer-btn text-on-primary hover:drop-shadow-[0_0_20px_rgba(219,252,255,0.5)]",
  solid: "bg-primary text-on-primary hover:drop-shadow-[0_0_20px_rgba(219,252,255,0.5)]",
  outline: "border border-primary text-primary hover:bg-primary/5",
  muted: "border border-on-surface-variant text-on-surface-variant hover:bg-white/5",
} as const;

const sizes = {
  sm: "rounded-full px-6 py-2",
  md: "rounded-lg px-8 py-4",
  lg: "rounded-lg px-10 py-5 text-lg",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

type StyleProps = { variant?: ButtonVariant; size?: ButtonSize; className?: string };

export function buttonStyles({ variant = "solid", size = "md", className }: StyleProps = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: StyleProps & ComponentProps<"button">) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...props} />;
}

/** Link styled as a button. External URLs open in a new tab with safe rel attributes. */
export function ButtonLink({
  variant,
  size,
  className,
  href,
  ...props
}: StyleProps & ComponentProps<typeof Link>) {
  const external = typeof href === "string" && /^https?:\/\//.test(href);
  return (
    <Link
      href={href}
      className={buttonStyles({ variant, size, className })}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...props}
    />
  );
}
