"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ProposalActionsProps {
  proposalId: string;
  title: string;
  body: string;
  status: string;
}

export function ProposalActions({
  proposalId,
  title: initialTitle,
  body: initialBody,
  status,
}: ProposalActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this proposal? This cannot be undone.")) return;
    const res = await fetch(`/api/proposals/${proposalId}`, {
      method: "DELETE",
    });
    if (res.ok) router.push("/proposals");
  }

  if (editing) {
    return (
      <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <label className="block text-sm font-medium text-zinc-400 mb-1">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-800 p-2 text-sm text-white mb-3 focus:border-emerald-600 focus:outline-none"
        />
        <label className="block text-sm font-medium text-zinc-400 mb-1">
          Body
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-800 p-2 text-sm text-zinc-300 resize-none focus:border-emerald-600 focus:outline-none"
          rows={8}
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            onClick={() => {
              setTitle(initialTitle);
              setBody(initialBody);
              setEditing(false);
            }}
            className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 flex gap-2 text-xs">
      <button
        onClick={() => setEditing(true)}
        className="rounded border border-zinc-700 px-3 py-1.5 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
      >
        Edit Proposal
      </button>
      <button
        onClick={handleDelete}
        className="rounded border border-zinc-700 px-3 py-1.5 text-zinc-400 hover:text-red-400 hover:border-red-800 transition-colors"
      >
        Delete
      </button>
      {status === "draft" && (
        <button
          onClick={async () => {
            await fetch(`/api/proposals/${proposalId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "open" }),
            });
            router.refresh();
          }}
          className="rounded bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 transition-colors"
        >
          Publish
        </button>
      )}
    </div>
  );
}
