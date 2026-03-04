"""Tests for vote casting and verification."""

import pytest

from skarchitect.categories import ProposalCategory
from skarchitect.crypto import generate_keypair
from skarchitect.models import EntityType, Proposal, ProposalStatus, VoteChoice
from skarchitect.voting import VoteStore


def _make_open_proposal() -> Proposal:
    p = Proposal(
        title="Test",
        body="Body",
        category=ProposalCategory.TECHNOLOGY,
        author_did="did:key:z6MkAuthor",
        author_type=EntityType.HUMAN,
        status=ProposalStatus.OPEN,
    )
    return p


def test_cast_vote():
    kp = generate_keypair()
    store = VoteStore()
    proposal = _make_open_proposal()

    vote = store.cast(proposal, kp.did_key, "approve", 7, kp.signing_key)
    assert vote.choice == VoteChoice.APPROVE
    assert vote.version == 1
    assert store.verify_vote(vote)


def test_change_vote():
    kp = generate_keypair()
    store = VoteStore()
    proposal = _make_open_proposal()

    v1 = store.cast(proposal, kp.did_key, "approve", 5, kp.signing_key)
    v2 = store.cast(proposal, kp.did_key, "reject", 3, kp.signing_key)

    assert v2.version == 2
    assert v2.choice == VoteChoice.REJECT

    # Only latest vote returned
    votes = store.list_by_proposal(proposal.proposal_id)
    assert len(votes) == 1
    assert votes[0].vote_id == v2.vote_id


def test_cannot_vote_on_draft():
    kp = generate_keypair()
    store = VoteStore()
    proposal = Proposal(
        title="Draft",
        body="Body",
        category=ProposalCategory.POLICY,
        author_did="did:key:z6MkTest",
        author_type=EntityType.HUMAN,
        status=ProposalStatus.DRAFT,
    )

    with pytest.raises(ValueError, match="not open"):
        store.cast(proposal, kp.did_key, "approve", 5, kp.signing_key)


def test_verify_vote_signature():
    kp = generate_keypair()
    store = VoteStore()
    proposal = _make_open_proposal()

    vote = store.cast(proposal, kp.did_key, "abstain", 5, kp.signing_key)
    assert store.verify_vote(vote)


def test_list_by_proposal():
    store = VoteStore()
    proposal = _make_open_proposal()

    for i in range(5):
        kp = generate_keypair()
        store.cast(proposal, kp.did_key, "approve", 5, kp.signing_key)

    votes = store.list_by_proposal(proposal.proposal_id)
    assert len(votes) == 5
