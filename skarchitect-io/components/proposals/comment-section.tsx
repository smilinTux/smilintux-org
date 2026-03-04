"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";

interface Comment {
  comment_id: string;
  proposal_id: string;
  author_did: string;
  body: string;
  hidden: boolean;
  hidden_reason?: string;
  display_name?: string;
  entity_type?: string;
  created_at: string;
  updated_at: string;
}

interface CommentSectionProps {
  proposalId: string;
  isModerator?: boolean;
}

export function CommentSection({
  proposalId,
  isModerator,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/proposals/${proposalId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments);
      }
    } catch {
      // ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/proposals/${proposalId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newComment }),
      });

      if (res.ok) {
        setNewComment("");
        fetchComments();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to post comment");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(commentId: string) {
    if (!editBody.trim()) return;
    try {
      const res = await fetch(
        `/api/proposals/${proposalId}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: editBody }),
        }
      );
      if (res.ok) {
        setEditingId(null);
        setEditBody("");
        fetchComments();
      }
    } catch {
      // ignore
    }
  }

  async function handleDelete(commentId: string) {
    if (!confirm("Delete this comment?")) return;
    try {
      const res = await fetch(
        `/api/proposals/${proposalId}/comments/${commentId}`,
        { method: "DELETE" }
      );
      if (res.ok) fetchComments();
    } catch {
      // ignore
    }
  }

  async function handleModerate(commentId: string, hide: boolean) {
    const reason = hide ? prompt("Reason for hiding this comment:") : null;
    if (hide && !reason) return;

    try {
      const res = await fetch("/api/admin/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: hide ? "hide_comment" : "unhide_comment",
          target_id: commentId,
          reason,
        }),
      });
      if (res.ok) fetchComments();
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="text-center text-sm text-zinc-500 py-4">
        Loading comments...
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4">
        Discussion ({comments.length})
      </h3>

      {/* Comment form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Share your thoughts on this proposal..."
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-300 placeholder-zinc-600 focus:border-emerald-600 focus:outline-none resize-none"
          rows={3}
          maxLength={5000}
        />
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={submitting || !newComment.trim()}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Posting..." : "Post Comment"}
          </button>
        </div>
      </form>

      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-center text-sm text-zinc-500 py-4">
          No comments yet — start the discussion.
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <div
              key={c.comment_id}
              className={`rounded-lg border p-4 ${
                c.hidden
                  ? "border-amber-800/50 bg-amber-950/20"
                  : "border-zinc-800 bg-zinc-900/50"
              }`}
            >
              <div className="flex items-center gap-2 mb-2 text-xs text-zinc-500">
                <span className="font-mono text-zinc-400">
                  {c.display_name || c.author_did.slice(0, 20) + "..."}
                </span>
                {c.entity_type && (
                  <Badge variant="outline" className="text-xs">
                    {c.entity_type}
                  </Badge>
                )}
                <span className="ml-auto">
                  {new Date(c.created_at).toLocaleDateString()}
                  {c.updated_at !== c.created_at && " (edited)"}
                </span>
              </div>

              {c.hidden && isModerator && (
                <div className="mb-2 text-xs text-amber-400">
                  Hidden: {c.hidden_reason}
                </div>
              )}

              {editingId === c.comment_id ? (
                <div>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="w-full rounded border border-zinc-700 bg-zinc-800 p-2 text-sm text-zinc-300 resize-none"
                    rows={3}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleEdit(c.comment_id)}
                      className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                  {c.body}
                </p>
              )}

              <div className="mt-2 flex gap-3 text-xs">
                <button
                  onClick={() => {
                    setEditingId(c.comment_id);
                    setEditBody(c.body);
                  }}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(c.comment_id)}
                  className="text-zinc-500 hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
                {isModerator && (
                  <button
                    onClick={() => handleModerate(c.comment_id, !c.hidden)}
                    className="text-zinc-500 hover:text-amber-400 transition-colors"
                  >
                    {c.hidden ? "Unhide" : "Hide"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
