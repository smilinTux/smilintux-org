"""Tests for tally computation with delegation."""

from skarchitect.categories import ProposalCategory
from skarchitect.crypto import generate_keypair
from skarchitect.delegation import DelegationStore
from skarchitect.models import EntityType, Proposal, ProposalStatus
from skarchitect.tally import compute_tally
from skarchitect.voting import VoteStore


def _open_proposal() -> Proposal:
    return Proposal(
        title="Test",
        body="Body",
        category=ProposalCategory.TECHNOLOGY,
        author_did="did:key:z6MkAuthor",
        author_type=EntityType.HUMAN,
        status=ProposalStatus.OPEN,
    )


def test_direct_votes_only():
    proposal = _open_proposal()
    votes = VoteStore()
    delegations = DelegationStore()

    kp1 = generate_keypair()
    kp2 = generate_keypair()
    kp3 = generate_keypair()

    votes.cast(proposal, kp1.did_key, "approve", 5, kp1.signing_key)
    votes.cast(proposal, kp2.did_key, "reject", 5, kp2.signing_key)
    votes.cast(proposal, kp3.did_key, "approve", 5, kp3.signing_key)

    tally = compute_tally(proposal, votes, delegations)
    assert tally.approve == 2
    assert tally.reject == 1
    assert tally.abstain == 0
    assert tally.total_direct == 3
    assert tally.total_delegated == 0


def test_delegated_votes():
    proposal = _open_proposal()
    votes = VoteStore()
    delegations = DelegationStore()

    alice = generate_keypair()
    bob = generate_keypair()

    # Bob delegates to Alice
    delegations.delegate(bob.did_key, alice.did_key)

    # Only Alice votes
    votes.cast(proposal, alice.did_key, "approve", 5, alice.signing_key)

    tally = compute_tally(proposal, votes, delegations)
    assert tally.approve == 2  # Alice's direct + Bob's delegated
    assert tally.total_direct == 1
    assert tally.total_delegated == 1


def test_direct_overrides_delegation():
    proposal = _open_proposal()
    votes = VoteStore()
    delegations = DelegationStore()

    alice = generate_keypair()
    bob = generate_keypair()

    delegations.delegate(bob.did_key, alice.did_key)

    # Both vote directly
    votes.cast(proposal, alice.did_key, "approve", 5, alice.signing_key)
    votes.cast(proposal, bob.did_key, "reject", 5, bob.signing_key)

    tally = compute_tally(proposal, votes, delegations)
    assert tally.approve == 1  # Only Alice
    assert tally.reject == 1  # Bob voted directly
    assert tally.total_direct == 2
    assert tally.total_delegated == 0  # Bob's direct vote overrides delegation


def test_chain_delegation():
    proposal = _open_proposal()
    votes = VoteStore()
    delegations = DelegationStore()

    alice = generate_keypair()
    bob = generate_keypair()
    charlie = generate_keypair()

    # Charlie → Bob → Alice
    delegations.delegate(charlie.did_key, bob.did_key)
    delegations.delegate(bob.did_key, alice.did_key)

    votes.cast(proposal, alice.did_key, "approve", 5, alice.signing_key)

    tally = compute_tally(proposal, votes, delegations)
    assert tally.approve == 3  # Alice direct + Bob delegated + Charlie delegated
    assert tally.total_direct == 1
    assert tally.total_delegated == 2
