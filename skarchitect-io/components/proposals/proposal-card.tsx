import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "./category-badge";

interface ProposalCardProps {
  proposal: {
    proposal_id: string;
    title: string;
    body: string;
    category: string;
    status: string;
    author_did: string;
    author_type: string;
    created_at: string;
  };
  showHidden?: boolean;
}

const statusColors: Record<string, string> = {
  draft: "bg-zinc-600/20 text-zinc-400",
  open: "bg-emerald-600/20 text-emerald-400",
  closed: "bg-red-600/20 text-red-400",
  archived: "bg-zinc-700/20 text-zinc-500",
};

export function ProposalCard({ proposal, showHidden }: ProposalCardProps) {
  return (
    <Link href={`/proposals/${proposal.proposal_id}`}>
      <Card className={`transition-colors hover:border-zinc-700 ${showHidden ? "border-amber-800/50 bg-amber-950/10" : "border-zinc-800 bg-zinc-900/50"}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg text-white">
              {showHidden && <span className="text-amber-400 text-xs mr-2">[HIDDEN]</span>}
              {proposal.title}
            </CardTitle>
            <Badge
              variant="outline"
              className={statusColors[proposal.status]}
            >
              {proposal.status}
            </Badge>
          </div>
          <CardDescription className="line-clamp-2">
            {proposal.body}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <CategoryBadge category={proposal.category} />
            <Badge variant="outline" className="text-xs text-zinc-500">
              {proposal.author_type}
            </Badge>
            <span className="ml-auto text-xs text-zinc-600">
              {new Date(proposal.created_at).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
