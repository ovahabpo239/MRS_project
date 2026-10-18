/**
 * Validate a post-login redirect target. Only same-site absolute paths are allowed, which
 * blocks open redirects such as `//evil.com`, `/\evil.com` or `https://evil.com`.
 */
export function safeNextPath(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
