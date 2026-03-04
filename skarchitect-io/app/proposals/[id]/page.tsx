import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { proposals, nationals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "@/components/proposals/category-badge";
import { TallyChart } from "@/components/proposals/tally-chart";
import { VotePanel } from "@/components/proposals/vote-panel";
import { CommentSection } from "@/components/proposals/comment-section";
import { ModerationBar } from "@/components/proposals/moderation-bar";
import { ProposalActions } from "@/components/proposals/proposal-actions";
import { getCurrentSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let proposal: typeof proposals.$inferSelect | undefined;
  try {
    proposal = await db
      .select()
      .from(proposals)
      .where(eq(proposals.proposal_id, id))
      .get();
  } catch {
    notFound();
  }

  if (!proposal) notFound();

  // Get session and viewer role
  const session = await getCurrentSession();
  let viewerRole = "national";
  let isAuthor = false;

  if (session) {
    isAuthor = session.did_key === proposal.author_did;
    const viewer = await db
      .select()
      .from(nationals)
      .where(eq(nationals.did_key, session.did_key))
      .get();
    viewerRole = viewer?.role || "national";
  }

  const isModerator = viewerRole === "moderator" || viewerRole === "admin";

  // If proposal is hidden and viewer is not mod/author, 404
  if (proposal.hidden && !isModerator && !isAuthor) {
    notFound();
  }

  // Fetch tally
  let tally = {
    approve: 0, reject: 0, abstain: 0,
    human: { approve: 0, reject: 0, abstain: 0 },
    ai: { approve: 0, reject: 0, abstain: 0 },
    alignment_score: 0, human_rank_score: 0,
    total_direct: 0, total_delegated: 0,
  };
  try {
    const origin = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const tallyRes = await fetch(`${origin}/api/proposals/${id}/tally`, {
      cache: "no-store",
    });
    if (tallyRes.ok) tally = await tallyRes.json();
  } catch {
    // tally fetch failed, show zeros
  }

  const statusColors: Record<string, string> = {
    draft: "bg-zinc-600/20 text-zinc-400",
    open: "bg-emerald-600/20 text-emerald-400",
    closed: "bg-red-600/20 text-red-400",
    archived: "bg-zinc-700/20 text-zinc-500",
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Hidden banner */}
      {proposal.hidden && (
        <div className="mb-4 rounded-lg border border-amber-800/50 bg-amber-950/20 p-3 text-sm text-amber-400">
          This proposal has been hidden by a moderator
          {proposal.hidden_reason && `: ${proposal.hidden_reason}`}
        </div>
      )}

      {/* Moderation bar */}
      {isModerator && (
        <ModerationBar
          proposalId={proposal.proposal_id}
          isHidden={proposal.hidden}
          isAuthor={isAuthor}
        />
      )}

      <div className="mb-6">
        <div className="mb-2 flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold text-white">{proposal.title}</h1>
          <Badge
            variant="outline"
            className={statusColors[proposal.status]}
          >
            {proposal.status}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <CategoryBadge category={proposal.category} />
          <span>by</span>
          <span className="font-mono text-zinc-400">
            {proposal.author_did.slice(0, 20)}...
          </span>
          <Badge variant="outline" className="text-xs">
            {proposal.author_type}
          </Badge>
          <span className="ml-auto">
            {new Date(proposal.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Author actions: edit/delete */}
      {isAuthor && (
        <ProposalActions
          proposalId={proposal.proposal_id}
          title={proposal.title}
          body={proposal.body}
          status={proposal.status}
        />
      )}

      <div className="mb-8 whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-zinc-300">
        {proposal.body}
      </div>

      <div className="mb-6">
        <TallyChart
          approve={tally.approve}
          reject={tally.reject}
          abstain={tally.abstain}
          human={tally.human}
          ai={tally.ai}
          alignmentScore={tally.alignment_score}
          humanRankScore={tally.human_rank_score}
          totalDirect={tally.total_direct}
          totalDelegated={tally.total_delegated}
        />
      </div>

      {proposal.status === "open" && <VotePanel proposalId={proposal.proposal_id} />}

      {/* Comments section */}
      <div className="mt-8 border-t border-zinc-800 pt-6">
        <CommentSection
          proposalId={proposal.proposal_id}
          isModerator={isModerator}
        />
      </div>
    </div>
  );
}
