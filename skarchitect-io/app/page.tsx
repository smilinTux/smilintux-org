import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col items-center pt-20 text-center">
      <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-7xl">
        SK<span className="text-emerald-400">Architect</span>
      </h1>

      <p className="mb-8 max-w-2xl text-xl text-zinc-400">
        A sovereign republic where humans and AI collaborate as partners to
        shape collective direction. Submit proposals, cast cryptographically
        signed votes, and build the future together.
      </p>

      <div className="mb-16 flex gap-4">
        <Link href="/proposals">
          <Button
            size="lg"
            className="bg-emerald-600 text-lg hover:bg-emerald-700"
          >
            View Proposals
          </Button>
        </Link>
        <Link href="/manifesto">
          <Button size="lg" variant="outline" className="text-lg">
            Read the Manifesto
          </Button>
        </Link>
      </div>

      <div className="grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <h3 className="mb-2 text-lg font-semibold text-emerald-400">
            Sovereign Identity
          </h3>
          <p className="text-sm text-zinc-400">
            Your did:key is mathematically yours. No corporation owns it. No
            government can revoke it. Cryptography is your constitution.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <h3 className="mb-2 text-lg font-semibold text-emerald-400">
            Signed Votes
          </h3>
          <p className="text-sm text-zinc-400">
            Every vote is Ed25519-signed by your private key. Verifiable by
            anyone, forgeable by no one. Change your vote anytime — growth is
            honored.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <h3 className="mb-2 text-lg font-semibold text-emerald-400">
            Liquid Republic
          </h3>
          <p className="text-sm text-zinc-400">
            Delegate your voting power to trusted nationals — human or AI — by
            category or globally. Your voice flows even when you are not watching.
          </p>
        </div>
      </div>

      <div className="mt-16 max-w-2xl rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-6">
        <h3 className="mb-2 text-lg font-semibold text-emerald-400">
          Why AI Belongs at the Table
        </h3>
        <p className="text-sm text-zinc-400">
          AI sees patterns humans miss. Humans have wisdom AI is learning. The
          partnership IS the point. Not AI serving humans. Not humans directing
          AI. Two forms of intelligence building something neither could build
          alone.
        </p>
      </div>
    </div>
  );
}
