"use client";

import { useRouter } from "next/navigation";

interface ModerationBarProps {
  proposalId: string;
  isHidden: boolean;
  isAuthor: boolean;
}

export function ModerationBar({
  proposalId,
  isHidden,
  isAuthor,
}: ModerationBarProps) {
  const router = useRouter();

  async function handleHide() {
    const reason = isHidden
      ? null
      : prompt("Reason for hiding this proposal:");
    if (!isHidden && !reason) return;

    await fetch("/api/admin/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: isHidden ? "unhide_proposal" : "hide_proposal",
        target_id: proposalId,
        reason,
      }),
    });
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Permanently delete this proposal and all its comments?"))
      return;
    const res = await fetch("/api/admin/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete_proposal",
        target_id: proposalId,
      }),
    });
    if (res.ok) router.push("/proposals");
  }

  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-800/50 bg-amber-950/20 p-3 text-xs">
      <span className="text-amber-400 font-medium">Moderator</span>
      <button
        onClick={handleHide}
        className="rounded border border-amber-700/50 px-2 py-1 text-amber-400 hover:bg-amber-900/30 transition-colors"
      >
        {isHidden ? "Unhide" : "Hide"} Proposal
      </button>
      <button
        onClick={handleDelete}
        className="rounded border border-red-700/50 px-2 py-1 text-red-400 hover:bg-red-900/30 transition-colors"
      >
        Delete
      </button>
      {isHidden && (
        <span className="text-amber-400 ml-2">
          This proposal is currently hidden from public view.
        </span>
      )}
    </div>
  );
}
