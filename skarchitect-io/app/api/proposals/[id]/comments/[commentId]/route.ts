import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { comments, nationals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/session";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { commentId } = await params;
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const comment = await db
    .select()
    .from(comments)
    .where(eq(comments.comment_id, commentId))
    .get();

  if (!comment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Author can edit, moderators/admins can also edit
  const viewer = await db
    .select()
    .from(nationals)
    .where(eq(nationals.did_key, session.did_key))
    .get();
  const isMod = viewer?.role === "moderator" || viewer?.role === "admin";

  if (comment.author_did !== session.did_key && !isMod) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { body } = await req.json();
  if (!body || typeof body !== "string" || body.trim().length === 0) {
    return NextResponse.json(
      { error: "Comment body is required" },
      { status: 400 }
    );
  }

  await db
    .update(comments)
    .set({ body: body.trim(), updated_at: new Date().toISOString() })
    .where(eq(comments.comment_id, commentId));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { commentId } = await params;
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const comment = await db
    .select()
    .from(comments)
    .where(eq(comments.comment_id, commentId))
    .get();

  if (!comment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Author can delete, moderators/admins can also delete
  const viewer = await db
    .select()
    .from(nationals)
    .where(eq(nationals.did_key, session.did_key))
    .get();
  const isMod = viewer?.role === "moderator" || viewer?.role === "admin";

  if (comment.author_did !== session.did_key && !isMod) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await db.delete(comments).where(eq(comments.comment_id, commentId));

  return NextResponse.json({ ok: true });
}
