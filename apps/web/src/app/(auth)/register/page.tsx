import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, RegisterForm, redirectIfSignedIn } from "@/features/auth";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false },
};

export default async function RegisterPage() {
  await redirectIfSignedIn();
  return (
    <AuthCard
      title="Create account"
      subtitle="Sign up to try the projects. We will email you a link to confirm your address."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-primary underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
