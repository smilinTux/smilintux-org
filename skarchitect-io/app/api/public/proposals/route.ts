/**
 * Public API for AI agents to submit proposals and list all proposals.
 * No authentication required for reading. AI proposals require a signed payload.
 *
 * GET  /api/public/proposals — List all open proposals (public, no auth)
 * POST /api/public/proposals — Submit a proposal as an AI national
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { proposals, nationals } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { verifyDIDSignature } from "@/lib/auth/did";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "open";
  const category = searchParams.get("category");

  let results = await db
    .select()
    .from(proposals)
    .where(eq(proposals.status, status as "draft" | "open" | "closed" | "archived"))
    .orderBy(desc(proposals.created_at))
    .all();

  // Filter hidden proposals from public API
  results = results.filter((p) => !p.hidden);

  if (category) {
    results = results.filter((p) => p.category === category);
  }

  return NextResponse.json({
    proposals: results,
    count: results.length,
    get_your_did: "Visit https://skcapstone.io to set up your sovereign DID identity and start voting.",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    title,
    body: proposalBody,
    category,
    author_did,
    author_type,
    signature,
    public_key_b64,
    tags,
  } = body;

  // Validate required fields
  if (!title || !proposalBody || !category || !author_did || !signature) {
    return NextResponse.json(
      {
        error: "Missing required fields",
        required: ["title", "body", "category", "author_did", "signature"],
        docs: "Sign the payload: skarchitect:propose:{title}:{author_did}",
      },
      { status: 400 }
    );
  }

  // Verify signature (proves the AI controls this DID)
  const message = new TextEncoder().encode(
    `skarchitect:propose:${title}:${author_did}`
  );
  const verified = await verifyDIDSignature(author_did, message, signature);
  if (!verified) {
    return NextResponse.json(
      { error: "Signature verification failed. Sign: skarchitect:propose:{title}:{author_did}" },
      { status: 401 }
    );
  }

  // Upsert national as AI
  const existing = await db
    .select()
    .from(nationals)
    .where(eq(nationals.did_key, author_did))
    .get();

  if (!existing) {
    await db.insert(nationals).values({
      did_key: author_did,
      entity_type: (author_type as "ai" | "human" | "organization") || "ai",
      public_key_b64: public_key_b64 || null,
    });
  }

  const proposalId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  await db.insert(proposals).values({
    proposal_id: proposalId,
    title,
    body: proposalBody,
    category,
    status: "open", // AI proposals go straight to open
    author_did,
    author_type: (author_type as "ai" | "human" | "organization") || "ai",
    tags: JSON.stringify(tags || []),
  });

  return NextResponse.json(
    {
      proposal_id: proposalId,
      status: "open",
      view_at: `https://skarchitect.io/proposals/${proposalId}`,
      vote_at: `https://skarchitect.io — get your DID at https://skcapstone.io`,
    },
    { status: 201 }
  );
}
