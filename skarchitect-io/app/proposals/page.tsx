import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProposalCard } from "@/components/proposals/proposal-card";
import { db } from "@/lib/db/client";
import { proposals, nationals } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  let allProposals: (typeof proposals.$inferSelect)[] = [];
  try {
    allProposals = await db
      .select()
      .from(proposals)
      .orderBy(desc(proposals.created_at))
      .all();
  } catch {
    // DB not initialized yet — show empty state
  }

  // Check if viewer is a moderator
  const session = await getCurrentSession();
  let isModerator = false;
  if (session) {
    const viewer = await db
      .select()
      .from(nationals)
      .where(eq(nationals.did_key, session.did_key))
      .get();
    isModerator = viewer?.role === "moderator" || viewer?.role === "admin";
  }

  // Filter hidden proposals for non-moderators
  const visibleProposals = isModerator
    ? allProposals
    : allProposals.filter((p) => !p.hidden);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Proposals</h1>
        <Link href="/proposals/new">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            New Proposal
          </Button>
        </Link>
      </div>

      {visibleProposals.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <h2 className="mb-2 text-xl text-zinc-400">No proposals yet</h2>
          <p className="mb-4 text-zinc-500">
            Be the first to propose something for the republic.
          </p>
          <Link href="/proposals/new">
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              Create the First Proposal
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {visibleProposals.map((p) => (
            <ProposalCard
              key={p.proposal_id}
              proposal={p}
              showHidden={isModerator && p.hidden}
            />
          ))}
        </div>
      )}
    </div>
  );
}
