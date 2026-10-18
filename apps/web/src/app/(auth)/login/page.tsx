import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, LoginForm, redirectIfSignedIn } from "@/features/auth";
import { safeNextPath } from "@/lib/urls";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  // Validated here and again in the action: the hidden field is user-controlled input.
  const target = typeof next === "string" ? safeNextPath(next, "") : "";
  await redirectIfSignedIn(target || "/");

  return (
    <AuthCard
      title="Sign in"
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="text-primary underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm next={target || undefined} />
    </AuthCard>
  );
}
