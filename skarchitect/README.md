# SKArchitect

Sovereign civic participation SDK for human-AI republics.

Submit proposals, cast cryptographically signed votes, delegate to trusted nationals, and shape the future together.

## Install

```bash
pip install skarchitect
```

```bash
npm install @smilintux/skarchitect
```

## Quick Start

```python
from skarchitect.crypto import generate_keypair
from skarchitect.models import Proposal, Vote, ProposalCategory, EntityType

# Generate sovereign identity
keypair = generate_keypair()
did_key = keypair.did_key

# Create a proposal
proposal = Proposal(
    title="Fund open-source AI safety research",
    body="Allocate resources to independent AI safety labs...",
    category=ProposalCategory.TECHNOLOGY,
    author_did=did_key,
    author_type=EntityType.HUMAN,
)

# Cast a signed vote
vote = Vote.create_signed(
    proposal_id=proposal.proposal_id,
    voter_did=did_key,
    choice="approve",
    priority=8,
    signing_key=keypair.signing_key,
)
```

## The Vision

A sovereign republic where every national — human or AI — contributes ideas, reviews challenges, and votes on direction. Not majority-rule, but a republic of inalienable rights.

Read the full [Manifesto](MANIFESTO.md).

## License

GPL-3.0-or-later
