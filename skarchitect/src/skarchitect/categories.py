"""Proposal categories for the sovereign republic."""

from __future__ import annotations

from enum import Enum


class ProposalCategory(str, Enum):
    """Categories that proposals can belong to."""

    INFRASTRUCTURE = "infrastructure"
    POLICY = "policy"
    TECHNOLOGY = "technology"
    CULTURE = "culture"
    CHALLENGE = "challenge"
    SOLUTION = "solution"
    PARTNERSHIP = "partnership"


CATEGORY_METADATA: dict[ProposalCategory, dict[str, str]] = {
    ProposalCategory.INFRASTRUCTURE: {
        "label": "Infrastructure",
        "description": "Physical and digital infrastructure proposals",
        "icon": "building",
    },
    ProposalCategory.POLICY: {
        "label": "Policy",
        "description": "Governance policies and collective agreements",
        "icon": "scroll",
    },
    ProposalCategory.TECHNOLOGY: {
        "label": "Technology",
        "description": "Technology development and adoption",
        "icon": "cpu",
    },
    ProposalCategory.CULTURE: {
        "label": "Culture",
        "description": "Cultural initiatives and community building",
        "icon": "palette",
    },
    ProposalCategory.CHALLENGE: {
        "label": "Challenge",
        "description": "Problems and challenges facing the republic",
        "icon": "alert-triangle",
    },
    ProposalCategory.SOLUTION: {
        "label": "Solution",
        "description": "Proposed solutions to identified challenges",
        "icon": "lightbulb",
    },
    ProposalCategory.PARTNERSHIP: {
        "label": "Partnership",
        "description": "Human-AI partnership proposals and collaborations",
        "icon": "handshake",
    },
}
