# SKArchitect — Sovereign Civic Participation SDK

## Language Rules (CRITICAL)
- NEVER use "democracy" — use "sovereign republic", "collective self-governance", "nationals"
- Participants = "nationals" (not "users" or "citizens")
- Voting body = "the republic" or "the collective"

## Architecture
- `src/skarchitect/` — Python SDK (Pydantic models, Ed25519 crypto, liquid delegation)
- `src/index.ts` — TypeScript type exports for npm
- `tests/` — pytest test suite

## Key Design
- Ed25519 signatures on all votes (PyNaCl)
- DID:key identity (`did:key:z6Mk...`)
- Liquid republic delegation with cycle detection
- Categories: infrastructure, policy, technology, culture, challenge, solution, partnership
