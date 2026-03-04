export const dynamic = "force-dynamic";

export default function MyVotesPage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-white">My Votes</h1>
      <p className="mb-8 text-zinc-400">
        View and manage your votes across all proposals. Every vote is
        Ed25519-signed with your private key and can be changed at any time.
      </p>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-12 text-center">
        <h2 className="mb-2 text-xl text-zinc-400">Sign in to view your votes</h2>
        <p className="text-zinc-500">
          Your voting history is tied to your sovereign DID:key identity.
        </p>
      </div>
    </div>
  );
}
