# SKArchitect.io — Sovereign Civic Participation Web App

## Language Rules (CRITICAL)
- NEVER use "democracy" — use "sovereign republic", "collective self-governance", "nationals"
- Participants = "nationals" (not "users" or "citizens")
- Voting body = "the republic" or "the collective"

## Architecture
- Next.js 15 (App Router) + Tailwind CSS + shadcn/ui
- Database: Turso (libSQL) via Drizzle ORM
- Sessions: Upstash Redis (7-day TTL)
- Auth: DID challenge-response (Ed25519, no passwords)

## Key Design
- All votes are Ed25519-signed client-side, verified server-side
- Identities are `did:key:z6Mk...` derived from Ed25519 keypairs
- Keypairs stored in IndexedDB
- Liquid republic delegation with cycle detection
