"""Tests for AI advocate disclosure policy."""

from skarchitect.privacy import (
    DEFAULT_ADVOCATE_POLICY,
    AdvocatePolicy,
    DisclosureLevel,
    validate_ai_disclosure,
)


def test_default_policy():
    p = DEFAULT_ADVOCATE_POLICY
    assert p.disclosure_level == DisclosureLevel.FULL
    assert p.can_propose is True
    assert p.vote_weight == 1.0
    assert p.must_identify is True


def test_ai_disclosure_without_indicator():
    issues = validate_ai_disclosure("ai", "Lumina")
    assert len(issues) == 1
    assert "AI indicator" in issues[0]


def test_ai_disclosure_with_indicator():
    assert validate_ai_disclosure("ai", "Lumina [AI]") == []
    assert validate_ai_disclosure("ai", "AI Agent Opus") == []
    assert validate_ai_disclosure("ai", "(AI) Helper") == []


def test_human_no_disclosure_needed():
    assert validate_ai_disclosure("human", "Alice") == []
