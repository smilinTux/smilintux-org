import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { delegations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const results = await db
    .select()
    .from(delegations)
    .where(
      and(
        eq(delegations.delegator_did, session.did_key),
        eq(delegations.active, true)
      )
    )
    .all();

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { delegate_did, category } = body;

  if (!delegate_did) {
    return NextResponse.json({ error: "Missing delegate_did" }, { status: 400 });
  }

  if (delegate_did === session.did_key) {
    return NextResponse.json({ error: "Cannot delegate to yourself" }, { status: 400 });
  }

  // Deactivate existing delegation for this category
  const existing = await db
    .select()
    .from(delegations)
    .where(
      and(
        eq(delegations.delegator_did, session.did_key),
        eq(delegations.active, true)
      )
    )
    .all();

  for (const d of existing) {
    if ((d.category || null) === (category || null)) {
      await db
        .update(delegations)
        .set({ active: false, updated_at: new Date().toISOString() })
        .where(eq(delegations.delegation_id, d.delegation_id));
    }
  }

  const delegationId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  await db.insert(delegations).values({
    delegation_id: delegationId,
    delegator_did: session.did_key,
    delegate_did,
    category: category || null,
    active: true,
  });

  return NextResponse.json({ delegation_id: delegationId }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { delegation_id } = body;

  if (!delegation_id) {
    return NextResponse.json({ error: "Missing delegation_id" }, { status: 400 });
  }

  const delegation = await db
    .select()
    .from(delegations)
    .where(eq(delegations.delegation_id, delegation_id))
    .get();

  if (!delegation || delegation.delegator_did !== session.did_key) {
    return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });
  }

  await db
    .update(delegations)
    .set({ active: false, updated_at: new Date().toISOString() })
    .where(eq(delegations.delegation_id, delegation_id));

  return NextResponse.json({ ok: true });
}
