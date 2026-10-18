import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { AuthCard, ResetPasswordForm } from "@/features/auth";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
  // Keep the single-use token out of the Referer header sent to any outbound link.
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthCard title="Choose a new password" subtitle="Pick a password you do not use elsewhere.">
      {typeof token === "string" && token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-4">
          <Alert tone="error">This reset link is incomplete.</Alert>
          <Link href="/forgot-password" className="text-primary underline underline-offset-4">
            Request a new link
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
