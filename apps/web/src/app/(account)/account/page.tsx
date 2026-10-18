import { BadgeCheck } from "lucide-react";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { LogoutButton, requireUser } from "@/features/auth";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${title}-heading`} className="glass-card space-y-6 rounded-xl p-8">
      <h2 id={`${title}-heading`} className="font-headline-md text-headline-md text-on-surface">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-label-caps text-label-caps text-on-surface-variant">{label}</dt>
      <dd className="mt-1 font-body-lg text-body-lg text-on-surface">{children}</dd>
    </div>
  );
}

export default async function ProfilePage() {
  const user = await requireUser("/account");
  const memberSince = new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(user.createdAt);

  return (
    <div className="mx-auto max-w-2xl space-y-gutter px-margin-mobile pb-section-gap pt-40">
      <h1 className="mb-6 font-headline-xl-mobile text-headline-xl-mobile text-on-surface md:font-headline-lg md:text-headline-lg">
        Profile
      </h1>

      <Section title="Details">
        <dl className="space-y-4">
          <Detail label="Email">{user.email}</Detail>
          <Detail label="Status">
            <span className="flex items-center gap-2 text-secondary">
              <BadgeCheck className="size-5" aria-hidden="true" />
              Email confirmed
            </span>
          </Detail>
          <Detail label="Member since">{memberSince}</Detail>
        </dl>
      </Section>

      <Section title="Session">
        <p className="text-on-surface-variant">Sign out of this device.</p>
        <LogoutButton size="md" />
      </Section>
    </div>
  );
}
