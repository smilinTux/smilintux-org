"""SKSkills MCP tool entrypoints for SKArchitect."""

from __future__ import annotations

from typing import Any


def create_proposal(
    title: str,
    body: str,
    category: str,
    author_did: str,
    author_type: str = "ai",
    tags: list[str] | None = None,
) -> dict[str, Any]:
    """Create a new proposal for the republic.

    Args:
        title: Proposal title (max 200 chars)
        body: Full proposal text
        category: One of: infrastructure, policy, technology, culture, challenge, solution, partnership
        author_did: DID:key of the proposing national
        author_type: human, ai, or organization
        tags: Optional tags
    """
    from skarchitect.categories import ProposalCategory
    from skarchitect.models import EntityType, Proposal

    proposal = Proposal(
        title=title,
        body=body,
        category=ProposalCategory(category),
        author_did=author_did,
        author_type=EntityType(author_type),
        tags=tags or [],
    )
    return proposal.model_dump(mode="json")


def cast_vote(
    proposal_id: str,
    voter_did: str,
    choice: str,
    priority: int = 5,
    signing_key_hex: str = "",
) -> dict[str, Any]:
    """Cast a signed vote on a proposal.

    Args:
        proposal_id: ID of the proposal to vote on
        voter_did: DID:key of the voter
        choice: approve, reject, or abstain
        priority: 1-10 priority weighting
        signing_key_hex: Hex-encoded 32-byte Ed25519 seed
    """
    from skarchitect.crypto import keypair_from_seed
    from skarchitect.models import Vote

    if not signing_key_hex:
        return {"error": "signing_key_hex required for vote signing"}

    keypair = keypair_from_seed(bytes.fromhex(signing_key_hex))
    vote = Vote.create_signed(
        proposal_id=proposal_id,
        voter_did=voter_did,
        choice=choice,
        priority=priority,
        signing_key=keypair.signing_key,
    )
    return vote.model_dump(mode="json")


def delegate_vote(
    delegator_did: str,
    delegate_did: str,
    category: str | None = None,
) -> dict[str, Any]:
    """Delegate voting power to another national.

    Args:
        delegator_did: DID:key of the delegator
        delegate_did: DID:key of the delegate
        category: Optional category scope (or all if None)
    """
    from skarchitect.categories import ProposalCategory
    from skarchitect.models import Delegation

    cat = ProposalCategory(category) if category else None
    delegation = Delegation(
        delegator_did=delegator_did,
        delegate_did=delegate_did,
        category=cat,
    )
    return delegation.model_dump(mode="json")


def get_tally(proposal_id: str) -> dict[str, Any]:
    """Get the current tally for a proposal.

    Args:
        proposal_id: ID of the proposal
    """
    return {
        "info": "Tally computation requires a store backend. Use the web API.",
        "proposal_id": proposal_id,
    }


def list_proposals(
    status: str | None = None,
    category: str | None = None,
) -> dict[str, Any]:
    """List proposals by status or category.

    Args:
        status: Filter by status (draft, open, closed, archived)
        category: Filter by category
    """
    return {
        "info": "Proposal listing requires a store backend. Use the web API at skarchitect.io.",
        "filters": {"status": status, "category": category},
    }
