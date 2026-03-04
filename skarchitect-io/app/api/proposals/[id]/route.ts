import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { proposals, comments, nationals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const proposal = await db
    .select()
    .from(proposals)
    .where(eq(proposals.proposal_id, id))
    .get();

  if (!proposal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(proposal);
}

export async function PATCH(
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

  if (!proposal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check permissions: author or moderator/admin
  const viewer = await db
    .select()
    .from(nationals)
    .where(eq(nationals.did_key, session.did_key))
    .get();
  const isMod = viewer?.role === "moderator" || viewer?.role === "admin";
  const isAuthor = proposal.author_did === session.did_key;

  if (!isAuthor && !isMod) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const { status, title, body: proposalBody, tags } = body;

  // Status transitions (author or mod can change)
  const validTransitions: Record<string, string[]> = {
    draft: ["open"],
    open: ["closed"],
    closed: ["archived"],
  };

  // Mods can also reopen closed proposals
  if (isMod) {
    validTransitions.closed = ["archived", "open"];
  }

  if (
    status &&
    !validTransitions[proposal.status]?.includes(status)
  ) {
    return NextResponse.json(
      { error: `Cannot transition from ${proposal.status} to ${status}` },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (status) updates.status = status;
  if (status === "closed") updates.closed_at = new Date().toISOString();

  // Only author can edit content (mods can only change status / hide)
  if (isAuthor) {
    if (title) updates.title = title;
    if (proposalBody) updates.body = proposalBody;
    if (tags) updates.tags = JSON.stringify(tags);
  }

  await db
    .update(proposals)
    .set(updates)
    .where(eq(proposals.proposal_id, id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
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

  if (!proposal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Author can delete their own, admins can delete any
  const viewer = await db
    .select()
    .from(nationals)
    .where(eq(nationals.did_key, session.did_key))
    .get();
  const isAdmin = viewer?.role === "admin";
  const isAuthor = proposal.author_did === session.did_key;

  if (!isAuthor && !isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Delete associated comments first
  await db.delete(comments).where(eq(comments.proposal_id, id));
  await db.delete(proposals).where(eq(proposals.proposal_id, id));

  return NextResponse.json({ ok: true });
}
