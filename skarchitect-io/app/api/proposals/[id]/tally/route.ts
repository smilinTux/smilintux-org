import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { votes, delegations, nationals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Get all direct votes for this proposal
  const directVotes = await db
    .select()
    .from(votes)
    .where(eq(votes.proposal_id, id))
    .all();

  // Get voter entity types
  const allNationals = await db.select().from(nationals).all();
  const entityTypes = new Map<string, string>();
  for (const n of allNationals) {
    entityTypes.set(n.did_key, n.entity_type);
  }

  // Build voter → choice map
  const voterChoices = new Map<string, string>();
  for (const v of directVotes) {
    voterChoices.set(v.voter_did, v.choice);
  }

  // Get active delegations
  const activeDelegations = await db
    .select()
    .from(delegations)
    .where(eq(delegations.active, true))
    .all();

  // Build delegation graph
  const delegationMap = new Map<string, string>();
  for (const d of activeDelegations) {
    delegationMap.set(d.delegator_did, d.delegate_did);
  }

  // Resolve delegated votes
  const delegatedChoices = new Map<string, string>();
  for (const [delegator, delegate] of delegationMap) {
    if (voterChoices.has(delegator)) continue;
    const visited = new Set<string>([delegator]);
    let current = delegate;
    while (current) {
      if (voterChoices.has(current)) {
        delegatedChoices.set(delegator, voterChoices.get(current)!);
        break;
      }
      if (visited.has(current)) break;
      visited.add(current);
      current = delegationMap.get(current) || "";
    }
  }

  // Count with human/AI breakdown
  const human = { approve: 0, reject: 0, abstain: 0 };
  const ai = { approve: 0, reject: 0, abstain: 0 };

  function count(did: string, choice: string) {
    const type = entityTypes.get(did) || "human";
    const target = type === "ai" ? ai : human;
    if (choice === "approve") target.approve++;
    else if (choice === "reject") target.reject++;
    else target.abstain++;
  }

  for (const [did, choice] of voterChoices) count(did, choice);
  for (const [did, choice] of delegatedChoices) count(did, choice);

  // Alignment score (cosine similarity)
  const humanTotal = human.approve + human.reject + human.abstain;
  const aiTotal = ai.approve + ai.reject + ai.abstain;
  let alignment = 0;
  if (humanTotal > 0 && aiTotal > 0) {
    const h = [human.approve / humanTotal, human.reject / humanTotal, human.abstain / humanTotal];
    const a = [ai.approve / aiTotal, ai.reject / aiTotal, ai.abstain / aiTotal];
    const dot = h[0] * a[0] + h[1] * a[1] + h[2] * a[2];
    const magH = Math.sqrt(h[0] ** 2 + h[1] ** 2 + h[2] ** 2);
    const magA = Math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2);
    alignment = magH && magA ? Math.round((dot / (magH * magA)) * 1000) / 1000 : 0;
  }

  return NextResponse.json({
    proposal_id: id,
    approve: human.approve + ai.approve,
    reject: human.reject + ai.reject,
    abstain: human.abstain + ai.abstain,
    human,
    ai,
    alignment_score: alignment,
    human_rank_score: human.approve - human.reject,
    total_direct: voterChoices.size,
    total_delegated: delegatedChoices.size,
    computed_at: new Date().toISOString(),
  });
}
