import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-margin-mobile pb-16 pt-32">
      <div className="glass-card space-y-6 rounded-2xl p-8">
        <div className="space-y-2">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{title}</h1>
          {subtitle && <p className="text-on-surface-variant">{subtitle}</p>}
        </div>
        {children}
      </div>
      {footer && (
        <p className="mt-6 text-center font-body-md text-body-md text-on-surface-variant">
          {footer}
        </p>
      )}
    </div>
  );
}
