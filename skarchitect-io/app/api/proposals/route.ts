import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { proposals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");

  let query = db.select().from(proposals);

  if (status) {
    query = query.where(eq(proposals.status, status as "draft" | "open" | "closed" | "archived")) as typeof query;
  }

  const results = await query.all();

  const filtered = category
    ? results.filter((p) => p.category === category)
    : results;

  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { title, body: proposalBody, category, tags } = body;

  if (!title || !proposalBody || !category) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const proposalId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  await db.insert(proposals).values({
    proposal_id: proposalId,
    title,
    body: proposalBody,
    category,
    status: "draft",
    author_did: session.did_key,
    author_type: session.entity_type as "human" | "ai" | "organization",
    tags: JSON.stringify(tags || []),
  });

  return NextResponse.json({ proposal_id: proposalId }, { status: 201 });
}
