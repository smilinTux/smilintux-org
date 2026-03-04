/**
 * Challenge-response auth for DID:key identities.
 */

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

const CHALLENGE_TTL = 300; // 5 minutes
const SESSION_TTL = 604800; // 7 days

export async function createChallenge(): Promise<{
  challenge: string;
  expires_at: string;
}> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const challenge = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const expiresAt = new Date(
    Date.now() + CHALLENGE_TTL * 1000
  ).toISOString();

  await redis.set(`challenge:${challenge}`, "pending", {
    ex: CHALLENGE_TTL,
  });

  return { challenge, expires_at: expiresAt };
}

export async function consumeChallenge(challenge: string): Promise<boolean> {
  const val = await redis.get(`challenge:${challenge}`);
  if (val !== "pending") return false;
  await redis.del(`challenge:${challenge}`);
  return true;
}

export async function createSession(
  didKey: string,
  entityType: string
): Promise<{ session_id: string; expires_at: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const sessionId = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const expiresAt = new Date(Date.now() + SESSION_TTL * 1000).toISOString();

  await redis.set(
    `session:${sessionId}`,
    JSON.stringify({ did_key: didKey, entity_type: entityType, expires_at: expiresAt }),
    { ex: SESSION_TTL }
  );

  return { session_id: sessionId, expires_at: expiresAt };
}

export async function getSession(
  sessionId: string
): Promise<{ did_key: string; entity_type: string; expires_at: string } | null> {
  const val = await redis.get<string>(`session:${sessionId}`);
  if (!val) return null;
  return typeof val === "string" ? JSON.parse(val) : val;
}
