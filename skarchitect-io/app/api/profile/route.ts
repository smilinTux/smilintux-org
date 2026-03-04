import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { nationals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const national = await db
    .select()
    .from(nationals)
    .where(eq(nationals.did_key, session.did_key))
    .get();

  if (!national) {
    return NextResponse.json({ error: "National not found" }, { status: 404 });
  }

  return NextResponse.json(national);
}

export async function PATCH(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { display_name, avatar_url } = body;

  const updates: Record<string, string> = {};
  if (display_name !== undefined) updates.display_name = display_name;
  if (avatar_url !== undefined) updates.avatar_url = avatar_url;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  await db
    .update(nationals)
    .set(updates)
    .where(eq(nationals.did_key, session.did_key));

  return NextResponse.json({ ok: true });
}
