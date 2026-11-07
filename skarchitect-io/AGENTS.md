# AGENTS.md (skarchitect-io)

SKArchitect.io, the sovereign civic participation web app. The root [AGENTS.md](../AGENTS.md)
applies; this file only adds what differs.

## Language rules (critical)

- NEVER use "democracy": use "sovereign republic", "collective self-governance", "nationals".
- Participants are "nationals" (not "users" or "citizens").
- The voting body is "the republic" or "the collective".

## Stack

- Next.js (App Router, version in `package.json`), Tailwind CSS, shadcn/ui.
- Database: Turso (libSQL) via Drizzle ORM (`drizzle.config.ts`).
- Sessions: Upstash Redis (7-day TTL).
- Auth: DID challenge-response (Ed25519, no passwords).

## Key design

- All votes are Ed25519-signed client-side and verified server-side.
- Identities are `did:key:z6Mk...` derived from Ed25519 keypairs, stored in IndexedDB.
- Liquid republic delegation with cycle detection.
