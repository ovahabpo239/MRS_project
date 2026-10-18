import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 256 bits of randomness, URL-safe. This is what the user holds (cookie or emailed link). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What the database stores. High-entropy tokens need no salt or slow hash. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
