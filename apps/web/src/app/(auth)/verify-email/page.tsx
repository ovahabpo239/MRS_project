import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, VerifyEmailForm } from "@/features/auth";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = {
  title: "Confirm email",
  robots: { index: false },
  // Keep the single-use token out of the Referer header sent to any outbound link.
  referrer: "no-referrer",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthCard title="Confirm your email" subtitle="One more step to activate your account.">
      {typeof token === "string" && token ? (
        <VerifyEmailForm token={token} />
      ) : (
        <div className="space-y-4">
          <Alert tone="error">This confirmation link is incomplete.</Alert>
          <Link href="/login" className="text-primary underline underline-offset-4">
            Go to sign in to request a new one
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
