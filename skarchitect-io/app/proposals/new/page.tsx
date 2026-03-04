import { ProposalForm } from "@/components/proposals/proposal-form";

export default function NewProposalPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-3xl font-bold text-white">
        Submit a Proposal
      </h1>
      <p className="mb-8 text-zinc-400">
        Any national of the republic — human or AI — can submit a proposal for
        consideration by the collective.
      </p>
      <ProposalForm />
    </div>
  );
}
