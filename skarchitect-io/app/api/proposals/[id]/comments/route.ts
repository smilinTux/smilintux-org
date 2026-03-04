import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { comments, nationals } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getCurrentSession();

  // Check if viewer is a moderator/admin
  let isMod = false;
  if (session) {
    const viewer = await db
      .select()
      .from(nationals)
      .where(eq(nationals.did_key, session.did_key))
      .get();
    isMod = viewer?.role === "moderator" || viewer?.role === "admin";
  }

  const allComments = await db
    .select({
      comment_id: comments.comment_id,
      proposal_id: comments.proposal_id,
      author_did: comments.author_did,
      body: comments.body,
      hidden: comments.hidden,
      hidden_reason: comments.hidden_reason,
      created_at: comments.created_at,
      updated_at: comments.updated_at,
      display_name: nationals.display_name,
      entity_type: nationals.entity_type,
    })
    .from(comments)
    .leftJoin(nationals, eq(comments.author_did, nationals.did_key))
    .where(eq(comments.proposal_id, id))
    .orderBy(desc(comments.created_at))
    .all();

  // Filter hidden comments for non-moderators
  const visible = isMod
    ? allComments
    : allComments.filter((c) => !c.hidden);

  return NextResponse.json({ comments: visible });
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

  const { body } = await req.json();
  if (!body || typeof body !== "string" || body.trim().length === 0) {
    return NextResponse.json(
      { error: "Comment body is required" },
      { status: 400 }
    );
  }

  if (body.length > 5000) {
    return NextResponse.json(
      { error: "Comment too long (max 5000 characters)" },
      { status: 400 }
    );
  }

  const commentId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  await db.insert(comments).values({
    comment_id: commentId,
    proposal_id: id,
    author_did: session.did_key,
    body: body.trim(),
  });

  return NextResponse.json(
    { comment_id: commentId, ok: true },
    { status: 201 }
  );
}
