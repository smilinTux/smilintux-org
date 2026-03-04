"""Core data models for the sovereign republic."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from skarchitect.categories import ProposalCategory


class EntityType(str, Enum):
    """Type of national in the republic."""

    HUMAN = "human"
    AI = "ai"
    ORGANIZATION = "organization"


class ProposalStatus(str, Enum):
    """Lifecycle status of a proposal."""

    DRAFT = "draft"
    OPEN = "open"
    CLOSED = "closed"
    ARCHIVED = "archived"


class VoteChoice(str, Enum):
    """Possible vote choices."""

    APPROVE = "approve"
    REJECT = "reject"
    ABSTAIN = "abstain"


class National(BaseModel):
    """A participant in the sovereign republic — human, AI, or organization."""

    did_key: str = Field(description="DID:key identifier (did:key:z6Mk...)")
    entity_type: EntityType
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    public_key_b64: Optional[str] = Field(
        default=None, description="Base64-encoded Ed25519 public key"
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Proposal(BaseModel):
    """A proposal submitted to the republic for consideration."""

    proposal_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:16])
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1)
    category: ProposalCategory
    status: ProposalStatus = ProposalStatus.DRAFT
    author_did: str
    author_type: EntityType
    tags: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    closed_at: Optional[datetime] = None


class Vote(BaseModel):
    """A cryptographically signed vote on a proposal."""

    vote_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:16])
    proposal_id: str
    voter_did: str
    choice: VoteChoice
    priority: int = Field(ge=1, le=10, default=5)
    signature: str = Field(description="Base64-encoded Ed25519 signature")
    version: int = Field(default=1, description="Incremented when vote is changed")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @classmethod
    def create_signed(
        cls,
        proposal_id: str,
        voter_did: str,
        choice: str | VoteChoice,
        priority: int,
        signing_key: "SigningKey",  # noqa: F821
        version: int = 1,
    ) -> Vote:
        """Create a vote with Ed25519 signature."""
        import base64

        from skarchitect.crypto import sign_message

        if isinstance(choice, str):
            choice = VoteChoice(choice)
        vote_id = uuid.uuid4().hex[:16]
        message = _vote_signing_payload(proposal_id, voter_did, choice.value, priority, version)
        sig_bytes = sign_message(message, signing_key)
        signature = base64.b64encode(sig_bytes).decode()
        return cls(
            vote_id=vote_id,
            proposal_id=proposal_id,
            voter_did=voter_did,
            choice=choice,
            priority=priority,
            signature=signature,
            version=version,
        )

    def verify(self, public_key: bytes) -> bool:
        """Verify this vote's signature against a public key."""
        import base64

        from skarchitect.crypto import verify_signature

        message = _vote_signing_payload(
            self.proposal_id, self.voter_did, self.choice.value, self.priority, self.version
        )
        sig_bytes = base64.b64decode(self.signature)
        return verify_signature(message, sig_bytes, public_key)


class Delegation(BaseModel):
    """Liquid republic delegation — delegate voting power to a trusted national."""

    delegation_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:16])
    delegator_did: str
    delegate_did: str
    category: Optional[ProposalCategory] = Field(
        default=None, description="Scope to category, or None for all"
    )
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TallyBreakdown(BaseModel):
    """Vote counts for a single entity type (human or AI)."""

    approve: int = 0
    reject: int = 0
    abstain: int = 0

    @property
    def total(self) -> int:
        return self.approve + self.reject + self.abstain


class Tally(BaseModel):
    """Computed vote tally for a proposal with human/AI breakdown.

    Proposals are ranked by human votes. AI votes show alignment
    and help surface new questions when human and AI perspectives diverge.
    """

    proposal_id: str
    # Combined totals
    approve: int = 0
    reject: int = 0
    abstain: int = 0
    # Human vs AI breakdown
    human: TallyBreakdown = Field(default_factory=TallyBreakdown)
    ai: TallyBreakdown = Field(default_factory=TallyBreakdown)
    # Metadata
    total_direct: int = 0
    total_delegated: int = 0
    alignment_score: float = Field(
        default=0.0,
        description="0-1 score of how aligned human and AI votes are (1 = perfect alignment)",
    )
    computed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def total(self) -> int:
        return self.approve + self.reject + self.abstain

    @property
    def human_rank_score(self) -> int:
        """Score used to rank proposals — based on human votes only."""
        return self.human.approve - self.human.reject


def _vote_signing_payload(
    proposal_id: str, voter_did: str, choice: str, priority: int, version: int
) -> bytes:
    """Canonical byte payload for vote signing."""
    return f"skarchitect:vote:{proposal_id}:{voter_did}:{choice}:{priority}:{version}".encode()
