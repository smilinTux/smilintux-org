"""Proposal lifecycle management."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from skarchitect.categories import ProposalCategory
from skarchitect.models import EntityType, Proposal, ProposalStatus


class ProposalStore:
    """In-memory proposal store for SDK use. Web app uses database."""

    def __init__(self) -> None:
        self._proposals: dict[str, Proposal] = {}

    def create(
        self,
        title: str,
        body: str,
        category: ProposalCategory,
        author_did: str,
        author_type: EntityType,
        tags: Optional[list[str]] = None,
    ) -> Proposal:
        """Create a new proposal in draft status."""
        proposal = Proposal(
            title=title,
            body=body,
            category=category,
            author_did=author_did,
            author_type=author_type,
            tags=tags or [],
        )
        self._proposals[proposal.proposal_id] = proposal
        return proposal

    def get(self, proposal_id: str) -> Optional[Proposal]:
        return self._proposals.get(proposal_id)

    def open(self, proposal_id: str) -> Proposal:
        """Transition a draft proposal to open status."""
        proposal = self._require(proposal_id)
        if proposal.status != ProposalStatus.DRAFT:
            raise ValueError(f"Can only open draft proposals, current: {proposal.status}")
        proposal.status = ProposalStatus.OPEN
        proposal.updated_at = datetime.now(timezone.utc)
        return proposal

    def close(self, proposal_id: str) -> Proposal:
        """Close an open proposal for voting."""
        proposal = self._require(proposal_id)
        if proposal.status != ProposalStatus.OPEN:
            raise ValueError(f"Can only close open proposals, current: {proposal.status}")
        proposal.status = ProposalStatus.CLOSED
        proposal.closed_at = datetime.now(timezone.utc)
        proposal.updated_at = datetime.now(timezone.utc)
        return proposal

    def archive(self, proposal_id: str) -> Proposal:
        """Archive a closed proposal."""
        proposal = self._require(proposal_id)
        if proposal.status != ProposalStatus.CLOSED:
            raise ValueError(f"Can only archive closed proposals, current: {proposal.status}")
        proposal.status = ProposalStatus.ARCHIVED
        proposal.updated_at = datetime.now(timezone.utc)
        return proposal

    def list_by_status(self, status: ProposalStatus) -> list[Proposal]:
        return [p for p in self._proposals.values() if p.status == status]

    def list_by_category(self, category: ProposalCategory) -> list[Proposal]:
        return [p for p in self._proposals.values() if p.category == category]

    def list_all(self) -> list[Proposal]:
        return list(self._proposals.values())

    def _require(self, proposal_id: str) -> Proposal:
        proposal = self._proposals.get(proposal_id)
        if not proposal:
            raise KeyError(f"Proposal not found: {proposal_id}")
        return proposal
