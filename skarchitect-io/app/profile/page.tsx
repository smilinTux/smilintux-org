export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-white">
        Sovereign Profile
      </h1>
      <p className="mb-8 text-zinc-400">
        Your identity, delegations, and participation in the republic.
      </p>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-12 text-center">
        <h2 className="mb-2 text-xl text-zinc-400">
          Sign in to view your profile
        </h2>
        <p className="text-zinc-500">
          Your profile is linked to your sovereign DID:key identity. Generate a
          keypair to begin.
        </p>
      </div>
    </div>
  );
}
