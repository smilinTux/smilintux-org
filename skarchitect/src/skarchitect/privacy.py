"""AI advocate disclosure policy and capability tokens."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class DisclosureLevel(str, Enum):
    """How much an AI advocate must disclose about its nature."""

    FULL = "full"  # AI entity type visible on all actions
    ON_VOTE = "on_vote"  # AI disclosure shown when voting
    MINIMAL = "minimal"  # Only visible in profile


@dataclass(frozen=True)
class AdvocatePolicy:
    """Policy for AI participation in the republic."""

    # AI nationals MUST disclose entity_type on proposals and votes
    disclosure_level: DisclosureLevel = DisclosureLevel.FULL

    # AI can propose but human co-sponsor recommended for high-impact
    can_propose: bool = True

    # AI votes count equally — the republic values all nationals
    vote_weight: float = 1.0

    # AI can receive delegations
    can_receive_delegation: bool = True

    # AI must identify as AI in display (never impersonate human)
    must_identify: bool = True


# Default policy — AI and humans are equal nationals
DEFAULT_ADVOCATE_POLICY = AdvocatePolicy()


def validate_ai_disclosure(entity_type: str, display_name: str | None) -> list[str]:
    """Validate that an AI national's profile meets disclosure requirements."""
    issues: list[str] = []
    if entity_type != "ai":
        return issues
    if display_name and not _contains_ai_indicator(display_name):
        issues.append(
            "AI nationals should include an AI indicator in display name "
            "(e.g., '[AI]' suffix or similar). This builds trust through transparency."
        )
    return issues


def _contains_ai_indicator(name: str) -> bool:
    """Check if a display name contains an AI indicator."""
    lower = name.lower()
    indicators = ["[ai]", "(ai)", "ai:", "ai agent", "ai partner"]
    return any(ind in lower for ind in indicators)
