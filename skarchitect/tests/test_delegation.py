"""Tests for liquid republic delegation."""

import pytest

from skarchitect.categories import ProposalCategory
from skarchitect.delegation import DelegationStore


def test_basic_delegation():
    store = DelegationStore()
    d = store.delegate("did:alice", "did:bob")
    assert d.active
    assert store.get_delegate("did:alice") == "did:bob"


def test_category_scoped_delegation():
    store = DelegationStore()
    store.delegate("did:alice", "did:bob", ProposalCategory.TECHNOLOGY)
    store.delegate("did:alice", "did:charlie", ProposalCategory.POLICY)

    assert store.get_delegate("did:alice", ProposalCategory.TECHNOLOGY) == "did:bob"
    assert store.get_delegate("did:alice", ProposalCategory.POLICY) == "did:charlie"


def test_global_fallback():
    store = DelegationStore()
    store.delegate("did:alice", "did:bob")  # global
    # No tech-specific delegation, should fall back to global
    assert store.get_delegate("did:alice", ProposalCategory.TECHNOLOGY) == "did:bob"


def test_category_overrides_global():
    store = DelegationStore()
    store.delegate("did:alice", "did:bob")  # global
    store.delegate("did:alice", "did:charlie", ProposalCategory.TECHNOLOGY)

    assert store.get_delegate("did:alice", ProposalCategory.TECHNOLOGY) == "did:charlie"
    assert store.get_delegate("did:alice", ProposalCategory.POLICY) == "did:bob"


def test_delegation_chain():
    store = DelegationStore()
    store.delegate("did:alice", "did:bob")
    store.delegate("did:bob", "did:charlie")

    chain = store.resolve_chain("did:alice")
    assert chain == ["did:bob", "did:charlie"]


def test_cycle_detection():
    store = DelegationStore()
    store.delegate("did:alice", "did:bob")
    store.delegate("did:bob", "did:charlie")

    with pytest.raises(ValueError, match="cycle"):
        store.delegate("did:charlie", "did:alice")


def test_self_delegation_rejected():
    store = DelegationStore()
    with pytest.raises(ValueError, match="yourself"):
        store.delegate("did:alice", "did:alice")


def test_revoke_delegation():
    store = DelegationStore()
    d = store.delegate("did:alice", "did:bob")
    store.revoke(d.delegation_id)
    assert store.get_delegate("did:alice") is None


def test_replace_delegation():
    store = DelegationStore()
    store.delegate("did:alice", "did:bob")
    store.delegate("did:alice", "did:charlie")
    assert store.get_delegate("did:alice") == "did:charlie"


def test_get_delegators():
    store = DelegationStore()
    store.delegate("did:alice", "did:charlie")
    store.delegate("did:bob", "did:charlie")
    delegators = store.get_delegators("did:charlie")
    assert set(delegators) == {"did:alice", "did:bob"}
