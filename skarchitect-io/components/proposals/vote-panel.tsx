"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface VotePanelProps {
  proposalId: string;
  currentChoice?: string;
  onVote?: (choice: string, priority: number) => Promise<void>;
}

export function VotePanel({ proposalId, currentChoice, onVote }: VotePanelProps) {
  const [selected, setSelected] = useState(currentChoice || "");
  const [priority, setPriority] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const choices = [
    { value: "approve", label: "Approve", color: "bg-emerald-600 hover:bg-emerald-700" },
    { value: "reject", label: "Reject", color: "bg-red-600 hover:bg-red-700" },
    { value: "abstain", label: "Abstain", color: "bg-zinc-600 hover:bg-zinc-700" },
  ];

  async function handleSubmit() {
    if (!selected || !onVote) return;
    setSubmitting(true);
    try {
      await onVote(selected, priority);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="mb-3 text-sm font-medium text-zinc-400">Cast Your Vote</h3>

      <div className="mb-4 flex gap-2">
        {choices.map(({ value, label, color }) => (
          <Button
            key={value}
            variant={selected === value ? "default" : "outline"}
            className={selected === value ? color : ""}
            onClick={() => setSelected(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs text-zinc-500">
          Priority (1-10): {priority}
        </label>
        <input
          type="range"
          min={1}
          max={10}
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          className="w-full accent-emerald-500"
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!selected || submitting}
        className="w-full bg-emerald-600 hover:bg-emerald-700"
      >
        {submitting
          ? "Signing..."
          : currentChoice
            ? "Change Vote"
            : "Submit Vote"}
      </Button>

      {currentChoice && (
        <p className="mt-2 text-xs text-zinc-500">
          Current vote: {currentChoice} (vote is changeable)
        </p>
      )}
    </div>
  );
}
