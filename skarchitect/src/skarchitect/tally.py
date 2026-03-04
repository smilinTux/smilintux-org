"""Tally computation with delegation resolution and human/AI breakdown."""

from __future__ import annotations

from typing import Optional

from skarchitect.delegation import DelegationStore
from skarchitect.models import Proposal, Tally, TallyBreakdown, Vote, VoteChoice
from skarchitect.voting import VoteStore


def compute_tally(
    proposal: Proposal,
    vote_store: VoteStore,
    delegation_store: DelegationStore,
    voter_types: Optional[dict[str, str]] = None,
) -> Tally:
    """Compute the tally for a proposal, resolving delegations.

    Produces separate human and AI vote counts. Proposals are ranked by
    human votes; AI votes show alignment and surface new questions.

    Args:
        voter_types: Optional map of DID → entity_type ("human"/"ai").
            If not provided, all voters are counted as "human".
    """
    voter_types = voter_types or {}
    direct_votes = vote_store.list_by_proposal(proposal.proposal_id)

    # Map voter DID → their direct vote choice
    direct_choices: dict[str, VoteChoice] = {}
    for vote in direct_votes:
        direct_choices[vote.voter_did] = vote.choice

    # Find all delegators who didn't vote directly
    all_delegators: set[str] = set()
    for vote in direct_votes:
        delegators = _get_all_delegators_recursive(vote.voter_did, delegation_store, proposal.category)
        all_delegators.update(delegators)

    # For each delegator without a direct vote, resolve their effective choice
    delegated_choices: dict[str, VoteChoice] = {}
    for delegator_did in all_delegators:
        if delegator_did in direct_choices:
            continue
        chain = delegation_store.resolve_chain(delegator_did, proposal.category)
        for delegate_did in chain:
            if delegate_did in direct_choices:
                delegated_choices[delegator_did] = direct_choices[delegate_did]
                break

    # Count with human/AI breakdown
    human = TallyBreakdown()
    ai = TallyBreakdown()

    def _count(did: str, choice: VoteChoice) -> None:
        entity_type = voter_types.get(did, "human")
        target = ai if entity_type == "ai" else human
        if choice == VoteChoice.APPROVE:
            target.approve += 1
        elif choice == VoteChoice.REJECT:
            target.reject += 1
        else:
            target.abstain += 1

    for did, choice in direct_choices.items():
        _count(did, choice)
    for did, choice in delegated_choices.items():
        _count(did, choice)

    # Compute alignment score
    alignment = compute_alignment(human, ai)

    return Tally(
        proposal_id=proposal.proposal_id,
        approve=human.approve + ai.approve,
        reject=human.reject + ai.reject,
        abstain=human.abstain + ai.abstain,
        human=human,
        ai=ai,
        total_direct=len(direct_choices),
        total_delegated=len(delegated_choices),
        alignment_score=alignment,
    )


def compute_alignment(human: TallyBreakdown, ai: TallyBreakdown) -> float:
    """Compute alignment score between human and AI votes (0-1).

    Uses cosine similarity of [approve, reject, abstain] vectors.
    Returns 0 if either side has no votes.
    """
    if human.total == 0 or ai.total == 0:
        return 0.0

    # Normalize to proportions
    h = [human.approve / human.total, human.reject / human.total, human.abstain / human.total]
    a = [ai.approve / ai.total, ai.reject / ai.total, ai.abstain / ai.total]

    # Cosine similarity
    dot = sum(x * y for x, y in zip(h, a))
    mag_h = sum(x * x for x in h) ** 0.5
    mag_a = sum(x * x for x in a) ** 0.5

    if mag_h == 0 or mag_a == 0:
        return 0.0

    return round(dot / (mag_h * mag_a), 3)


def _get_all_delegators_recursive(
    delegate_did: str,
    delegation_store: DelegationStore,
    category=None,
) -> set[str]:
    """Get all nationals who have (transitively) delegated to this delegate."""
    result: set[str] = set()
    direct = delegation_store.get_delegators(delegate_did, category)
    for d in direct:
        result.add(d)
        result.update(_get_all_delegators_recursive(d, delegation_store, category))
    return result
