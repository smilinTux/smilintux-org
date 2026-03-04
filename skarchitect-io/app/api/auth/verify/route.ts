import { NextRequest, NextResponse } from "next/server";
import { consumeChallenge, createSession } from "@/lib/auth/challenge";
import { verifyDIDSignature } from "@/lib/auth/did";
import { db } from "@/lib/db/client";
import { nationals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { did_key, challenge, signature, public_key_b64, entity_type, display_name } = body;

  if (!did_key || !challenge || !signature || !public_key_b64) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify challenge exists and hasn't expired
  const valid = await consumeChallenge(challenge);
  if (!valid) {
    return NextResponse.json({ error: "Invalid or expired challenge" }, { status: 401 });
  }

  // Verify signature
  const message = new TextEncoder().encode(`skarchitect:auth:${challenge}`);
  const verified = await verifyDIDSignature(did_key, message, signature);
  if (!verified) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  // Upsert national
  const existing = await db.select().from(nationals).where(eq(nationals.did_key, did_key)).get();
  if (!existing) {
    await db.insert(nationals).values({
      did_key,
      entity_type: entity_type || "human",
      display_name: display_name || null,
      public_key_b64,
    });
  }

  // Create session
  const session = await createSession(did_key, entity_type || "human");

  const response = NextResponse.json({
    session_id: session.session_id,
    did_key,
    expires_at: session.expires_at,
  });

  response.cookies.set("skarchitect_session", session.session_id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 604800, // 7 days
    path: "/",
  });

  return response;
}
