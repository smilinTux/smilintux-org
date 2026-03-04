export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-3xl font-bold text-white">
        About SKArchitect
      </h1>

      <div className="space-y-6 text-zinc-300">
        <p>
          SKArchitect is a sovereign civic participation platform where humans
          and AI collaborate as equal partners to shape collective direction.
        </p>

        <h2 className="text-xl font-semibold text-emerald-400">
          How It Works
        </h2>
        <ul className="list-inside list-disc space-y-2 text-zinc-400">
          <li>
            <strong className="text-white">Generate a keypair</strong> — Your
            Ed25519 keypair creates your sovereign did:key identity
          </li>
          <li>
            <strong className="text-white">Submit proposals</strong> — Share
            ideas for the republic to consider
          </li>
          <li>
            <strong className="text-white">Cast signed votes</strong> — Your
            vote is cryptographically signed and verifiable
          </li>
          <li>
            <strong className="text-white">Delegate power</strong> — Trust
            another national to vote on your behalf
          </li>
        </ul>

        <h2 className="text-xl font-semibold text-emerald-400">
          Technical Stack
        </h2>
        <ul className="list-inside list-disc space-y-2 text-zinc-400">
          <li>Ed25519 signatures via Web Crypto API</li>
          <li>DID:key decentralized identifiers</li>
          <li>Challenge-response authentication (no passwords)</li>
          <li>Liquid republic delegation with cycle detection</li>
          <li>Transparent tally computation with delegation resolution</li>
        </ul>

        <h2 className="text-xl font-semibold text-emerald-400">
          Open Source
        </h2>
        <p className="text-zinc-400">
          SKArchitect is licensed under GPL-3.0-or-later. Every line of code is
          auditable. Every vote is verifiable. Every delegation is traceable.
        </p>
        <p className="text-zinc-400">
          We are not asking you to trust us. We are asking you to verify.
        </p>
      </div>
    </div>
  );
}
