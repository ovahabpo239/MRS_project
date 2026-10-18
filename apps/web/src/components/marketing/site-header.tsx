import { unstable_rethrow } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser, type SessionUser } from "@/features/auth";

/** A broken database must not take the whole site down: treat the visitor as signed out. */
async function currentUserOrNull(): Promise<SessionUser | null> {
  try {
    return await getCurrentUser();
  } catch (error) {
    // Next signals "this route is dynamic" by throwing; swallowing it would let the page be
    // prerendered with a signed-out header.
    unstable_rethrow(error);
    console.error(
      JSON.stringify({ level: "error", msg: "session lookup failed", error: String(error) }),
    );
    return null;
  }
}

export async function SiteHeader() {
  const user = await currentUserOrNull();

  return (
    <Header
      actions={
        user ? (
          <ButtonLink href="/account" variant="outline" size="sm">
            Profile
          </ButtonLink>
        ) : (
          <>
            <ButtonLink href="/login" variant="muted" size="sm">
              Sign in
            </ButtonLink>
            <ButtonLink href="/register" variant="shimmer" size="sm">
              Sign up
            </ButtonLink>
          </>
        )
      }
    />
  );
}
