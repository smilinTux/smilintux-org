import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { votes, proposals } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/session";
import { verifyDIDSignature } from "@/lib/auth/did";
import {
  voteSigningPayload,
} from "@/lib/crypto/ed25519";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const results = await db
    .select()
    .from(votes)
    .where(eq(votes.proposal_id, id))
    .all();

  return NextResponse.json(results);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const proposal = await db
    .select()
    .from(proposals)
    .where(eq(proposals.proposal_id, id))
    .get();

  if (!proposal || proposal.status !== "open") {
    return NextResponse.json(
      { error: "Proposal not found or not open for voting" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { choice, priority, signature } = body;

  if (!choice || !signature) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Check for existing vote
  const existing = await db
    .select()
    .from(votes)
    .where(
      and(eq(votes.proposal_id, id), eq(votes.voter_did, session.did_key))
    )
    .get();

  const version = existing ? existing.version + 1 : 1;

  // Verify signature
  const payload = voteSigningPayload(
    id,
    session.did_key,
    choice,
    priority || 5,
    version
  );
  const verified = await verifyDIDSignature(
    session.did_key,
    payload,
    signature
  );
  if (!verified) {
    return NextResponse.json(
      { error: "Vote signature verification failed" },
      { status: 401 }
    );
  }

  const voteId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  if (existing) {
    // Update existing vote
    await db
      .update(votes)
      .set({
        choice,
        priority: priority || 5,
        signature,
        version,
        updated_at: new Date().toISOString(),
      })
      .where(eq(votes.vote_id, existing.vote_id));
  } else {
    await db.insert(votes).values({
      vote_id: voteId,
      proposal_id: id,
      voter_did: session.did_key,
      choice,
      priority: priority || 5,
      signature,
      version,
    });
  }

  return NextResponse.json(
    { vote_id: existing?.vote_id || voteId, version },
    { status: existing ? 200 : 201 }
  );
}
