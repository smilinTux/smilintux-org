"""Tests for core data models."""

import pytest

from skarchitect.categories import ProposalCategory
from skarchitect.crypto import generate_keypair
from skarchitect.models import (
    Delegation,
    EntityType,
    National,
    Proposal,
    ProposalStatus,
    Tally,
    Vote,
    VoteChoice,
)


def test_national_creation():
    kp = generate_keypair()
    n = National(did_key=kp.did_key, entity_type=EntityType.HUMAN, display_name="Alice")
    assert n.entity_type == EntityType.HUMAN
    assert n.did_key.startswith("did:key:z")


def test_proposal_creation():
    p = Proposal(
        title="Test Proposal",
        body="Body text",
        category=ProposalCategory.TECHNOLOGY,
        author_did="did:key:z6MkTest",
        author_type=EntityType.AI,
    )
    assert p.status == ProposalStatus.DRAFT
    assert p.proposal_id
    assert len(p.proposal_id) == 16


def test_proposal_title_validation():
    with pytest.raises(Exception):
        Proposal(
            title="",
            body="Body",
            category=ProposalCategory.POLICY,
            author_did="did:key:z6MkTest",
            author_type=EntityType.HUMAN,
        )


def test_vote_create_signed():
    kp = generate_keypair()
    vote = Vote.create_signed(
        proposal_id="abc123",
        voter_did=kp.did_key,
        choice="approve",
        priority=8,
        signing_key=kp.signing_key,
    )
    assert vote.choice == VoteChoice.APPROVE
    assert vote.priority == 8
    assert vote.signature
    assert vote.verify(kp.public_key_bytes)


def test_vote_verify_wrong_key():
    kp1 = generate_keypair()
    kp2 = generate_keypair()
    vote = Vote.create_signed(
        proposal_id="abc123",
        voter_did=kp1.did_key,
        choice="reject",
        priority=5,
        signing_key=kp1.signing_key,
    )
    assert not vote.verify(kp2.public_key_bytes)


def test_vote_priority_bounds():
    with pytest.raises(Exception):
        Vote.create_signed(
            proposal_id="abc",
            voter_did="did:key:z6MkTest",
            choice="approve",
            priority=11,
            signing_key=generate_keypair().signing_key,
        )


def test_delegation_creation():
    d = Delegation(
        delegator_did="did:key:z6MkAlice",
        delegate_did="did:key:z6MkBob",
        category=ProposalCategory.TECHNOLOGY,
    )
    assert d.active is True
    assert d.category == ProposalCategory.TECHNOLOGY


def test_tally():
    t = Tally(proposal_id="test", approve=10, reject=3, abstain=2, total_direct=12, total_delegated=3)
    assert t.total == 15
