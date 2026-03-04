/**
 * Moderation API — admin/moderator actions.
 *
 * POST /api/admin/moderate
 * Actions: hide_proposal, unhide_proposal, hide_comment, unhide_comment,
 *          delete_proposal, delete_comment, set_role
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { proposals, comments, nationals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/session";

async function requireModerator(session: { did_key: string }) {
  const national = await db
    .select()
    .from(nationals)
    .where(eq(nationals.did_key, session.did_key))
    .get();
  return national?.role === "moderator" || national?.role === "admin";
}

async function requireAdmin(session: { did_key: string }) {
  const national = await db
    .select()
    .from(nationals)
    .where(eq(nationals.did_key, session.did_key))
    .get();
  return national?.role === "admin";
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { action, target_id, reason, target_did, role } = body;

  switch (action) {
    case "hide_proposal": {
      if (!(await requireModerator(session))) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      await db
        .update(proposals)
        .set({
          hidden: true,
          hidden_by: session.did_key,
          hidden_reason: reason || "Hidden by moderator",
          updated_at: new Date().toISOString(),
        })
        .where(eq(proposals.proposal_id, target_id));
      return NextResponse.json({ ok: true, action: "proposal_hidden" });
    }

    case "unhide_proposal": {
      if (!(await requireModerator(session))) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      await db
        .update(proposals)
        .set({
          hidden: false,
          hidden_by: null,
          hidden_reason: null,
          updated_at: new Date().toISOString(),
        })
        .where(eq(proposals.proposal_id, target_id));
      return NextResponse.json({ ok: true, action: "proposal_unhidden" });
    }

    case "hide_comment": {
      if (!(await requireModerator(session))) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      await db
        .update(comments)
        .set({
          hidden: true,
          hidden_by: session.did_key,
          hidden_reason: reason || "Hidden by moderator",
          updated_at: new Date().toISOString(),
        })
        .where(eq(comments.comment_id, target_id));
      return NextResponse.json({ ok: true, action: "comment_hidden" });
    }

    case "unhide_comment": {
      if (!(await requireModerator(session))) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      await db
        .update(comments)
        .set({
          hidden: false,
          hidden_by: null,
          hidden_reason: null,
          updated_at: new Date().toISOString(),
        })
        .where(eq(comments.comment_id, target_id));
      return NextResponse.json({ ok: true, action: "comment_unhidden" });
    }

    case "delete_proposal": {
      if (!(await requireAdmin(session))) {
        return NextResponse.json(
          { error: "Admin required for deletion" },
          { status: 403 }
        );
      }
      await db.delete(comments).where(eq(comments.proposal_id, target_id));
      await db.delete(proposals).where(eq(proposals.proposal_id, target_id));
      return NextResponse.json({ ok: true, action: "proposal_deleted" });
    }

    case "delete_comment": {
      if (!(await requireModerator(session))) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      await db.delete(comments).where(eq(comments.comment_id, target_id));
      return NextResponse.json({ ok: true, action: "comment_deleted" });
    }

    case "set_role": {
      if (!(await requireAdmin(session))) {
        return NextResponse.json(
          { error: "Admin required to set roles" },
          { status: 403 }
        );
      }
      if (!["national", "moderator", "admin"].includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      await db
        .update(nationals)
        .set({ role })
        .where(eq(nationals.did_key, target_did));
      return NextResponse.json({ ok: true, action: "role_updated", role });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
