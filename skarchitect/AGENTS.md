# AGENTS.md (skarchitect)

SKArchitect, the sovereign civic participation SDK. The root [AGENTS.md](../AGENTS.md) applies; this
file only adds what differs.

## Language rules (critical)

- NEVER use "democracy": use "sovereign republic", "collective self-governance", "nationals".
- Participants are "nationals" (not "users" or "citizens").
- The voting body is "the republic" or "the collective".

## Layout

- `src/skarchitect/`: Python SDK (Pydantic models, Ed25519 crypto, liquid delegation).
- `src/index.ts`: TypeScript type exports for npm.
- `tests/`: pytest suite.

## Key design

- Ed25519 signatures on all votes (PyNaCl).
- `did:key` identity (`did:key:z6Mk...`).
- Liquid republic delegation with cycle detection (`delegation.py`).
- Categories (`categories.py`): infrastructure, policy, technology, culture, challenge, solution,
  partnership.
