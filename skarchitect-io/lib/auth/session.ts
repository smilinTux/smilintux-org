/**
 * Session helpers for API routes.
 */

import { cookies } from "next/headers";
import { getSession } from "./challenge";

export async function getCurrentSession(): Promise<{
  did_key: string;
  entity_type: string;
} | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("skarchitect_session")?.value;
  if (!sessionId) return null;
  return getSession(sessionId);
}
