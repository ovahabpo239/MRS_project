import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, ForgotPasswordForm, redirectIfSignedIn } from "@/features/auth";

export const metadata: Metadata = {
  title: "Forgot password",
  robots: { index: false },
};

export default async function ForgotPasswordPage() {
  await redirectIfSignedIn();
  return (
    <AuthCard
      title="Forgot password"
      subtitle="Enter your email and we will send you a link to choose a new password."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="text-primary underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
