import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { isSecureSite } from "@/lib/env";
import { deleteSession, findSessionUser, insertSession, type SessionUser } from "./session-store";

export type { SessionUser };

// `__Host-` pins the cookie to this exact origin; browsers require Secure for it, so it is
// only used when the site is served over https.
function cookieName(): string {
  return isSecureSite() ? "__Host-session" : "session";
}

/** Start a session for a user and set the cookie. Call only from actions or route handlers. */
export async function startSession(userId: string): Promise<void> {
  const { token, expiresAt } = await insertSession(userId);
  (await cookies()).set(cookieName(), token, {
    httpOnly: true,
    secure: isSecureSite(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** The signed-in user for this request, or null. Memoised per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(cookieName())?.value;
  return token ? findSessionUser(token) : null;
});

/** Revoke the current session server-side and clear the cookie. */
export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(cookieName())?.value;
  if (token) await deleteSession(token);
  jar.delete(cookieName());
}
