import "server-only";
import { hash, verify, type Algorithm } from "@node-rs/argon2";

// `Algorithm` is a const enum, which isolatedModules cannot import; 2 is Algorithm.Argon2id.
const ARGON2ID = 2 as Algorithm;

// Argon2id with the OWASP-recommended minimum cost (19 MiB, 2 iterations, 1 lane).
const options = { algorithm: ARGON2ID, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, options);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // A malformed stored hash must never authenticate.
    return false;
  }
}

let dummy: Promise<string> | undefined;

/**
 * Verify against a throwaway hash so "unknown email" costs the same time as "wrong password",
 * which keeps response timing from revealing which emails are registered.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummy ??= hashPassword("dummy-password-for-timing-equalisation");
  await verifyPassword(await dummy, password);
  return false;
}
