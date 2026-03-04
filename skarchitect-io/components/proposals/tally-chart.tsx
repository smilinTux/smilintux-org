"use client";

interface TallyBreakdown {
  approve: number;
  reject: number;
  abstain: number;
}

interface TallyChartProps {
  approve: number;
  reject: number;
  abstain: number;
  human: TallyBreakdown;
  ai: TallyBreakdown;
  alignmentScore: number;
  humanRankScore: number;
  totalDirect: number;
  totalDelegated: number;
}

function Bar({
  label,
  approve,
  reject,
  abstain,
}: {
  label: string;
  approve: number;
  reject: number;
  abstain: number;
}) {
  const total = approve + reject + abstain;
  if (total === 0) return null;
  const pA = Math.round((approve / total) * 100);
  const pR = Math.round((reject / total) * 100);

  return (
    <div className="mb-2">
      <div className="mb-1 flex justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span>{total} votes</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-zinc-800">
        {pA > 0 && (
          <div className="bg-emerald-500" style={{ width: `${pA}%` }} />
        )}
        {pR > 0 && (
          <div className="bg-red-500" style={{ width: `${pR}%` }} />
        )}
        {100 - pA - pR > 0 && (
          <div className="bg-zinc-600" style={{ width: `${100 - pA - pR}%` }} />
        )}
      </div>
      <div className="mt-1 flex gap-4 text-xs">
        <span className="text-emerald-400">{approve} approve</span>
        <span className="text-red-400">{reject} reject</span>
        <span className="text-zinc-500">{abstain} abstain</span>
      </div>
    </div>
  );
}

export function TallyChart({
  approve,
  reject,
  abstain,
  human,
  ai,
  alignmentScore,
  humanRankScore,
  totalDirect,
  totalDelegated,
}: TallyChartProps) {
  const total = approve + reject + abstain;

  if (total === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-center text-sm text-zinc-500">
        No votes yet — be the first to shape this proposal.
        <p className="mt-1 text-xs">
          Need a DID?{" "}
          <a
            href="https://skcapstone.io"
            className="text-emerald-400 underline"
          >
            Get your sovereign identity at skcapstone.io
          </a>
        </p>
      </div>
    );
  }

  const alignmentPct = Math.round(alignmentScore * 100);
  const humanTotal = human.approve + human.reject + human.abstain;
  const aiTotal = ai.approve + ai.reject + ai.abstain;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-400">
          Tally — ranked by human votes
        </h3>
        {humanTotal > 0 && aiTotal > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Alignment</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                alignmentPct >= 80
                  ? "bg-emerald-900/50 text-emerald-400"
                  : alignmentPct >= 50
                    ? "bg-amber-900/50 text-amber-400"
                    : "bg-red-900/50 text-red-400"
              }`}
            >
              {alignmentPct}%
            </span>
          </div>
        )}
      </div>

      {/* Human votes — primary ranking */}
      <Bar
        label="Human Nationals"
        approve={human.approve}
        reject={human.reject}
        abstain={human.abstain}
      />

      {/* AI votes — alignment signal */}
      <Bar
        label="AI Nationals"
        approve={ai.approve}
        reject={ai.reject}
        abstain={ai.abstain}
      />

      {/* Alignment insight */}
      {humanTotal > 0 && aiTotal > 0 && alignmentPct < 70 && (
        <div className="mt-3 rounded-md border border-amber-900/50 bg-amber-950/20 p-3 text-xs text-amber-400">
          Human and AI perspectives diverge on this proposal — this could
          surface important questions worth exploring.
        </div>
      )}

      <div className="mt-3 flex gap-4 text-xs text-zinc-500">
        <span>Direct: {totalDirect}</span>
        <span>Delegated: {totalDelegated}</span>
        <span>Human rank: {humanRankScore >= 0 ? "+" : ""}{humanRankScore}</span>
      </div>
    </div>
  );
}
