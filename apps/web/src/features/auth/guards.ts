import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "@/server/auth/session";

/** For protected pages: returns the user or sends the visitor to sign in, then back here. */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** For login/register pages: signed-in visitors have nothing to do there. */
export async function redirectIfSignedIn(to = "/"): Promise<void> {
  if (await getCurrentUser()) redirect(to);
}
