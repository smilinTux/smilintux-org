"""Vote casting and signature verification."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from nacl.signing import SigningKey

from skarchitect.crypto import did_to_public_key
from skarchitect.models import Proposal, ProposalStatus, Vote, VoteChoice


class VoteStore:
    """In-memory vote store for SDK use. Web app uses database."""

    def __init__(self) -> None:
        self._votes: dict[str, Vote] = {}
        # Index: (proposal_id, voter_did) → vote_id (latest)
        self._by_proposal_voter: dict[tuple[str, str], str] = {}

    def cast(
        self,
        proposal: Proposal,
        voter_did: str,
        choice: str | VoteChoice,
        priority: int,
        signing_key: SigningKey,
    ) -> Vote:
        """Cast a signed vote on an open proposal."""
        if proposal.status != ProposalStatus.OPEN:
            raise ValueError(f"Proposal is not open for voting: {proposal.status}")

        # Check for existing vote (allows changing)
        existing_id = self._by_proposal_voter.get((proposal.proposal_id, voter_did))
        version = 1
        if existing_id:
            existing = self._votes[existing_id]
            version = existing.version + 1

        vote = Vote.create_signed(
            proposal_id=proposal.proposal_id,
            voter_did=voter_did,
            choice=choice,
            priority=priority,
            signing_key=signing_key,
            version=version,
        )
        self._votes[vote.vote_id] = vote
        self._by_proposal_voter[(proposal.proposal_id, voter_did)] = vote.vote_id
        return vote

    def get(self, vote_id: str) -> Optional[Vote]:
        return self._votes.get(vote_id)

    def get_by_proposal_voter(self, proposal_id: str, voter_did: str) -> Optional[Vote]:
        vid = self._by_proposal_voter.get((proposal_id, voter_did))
        return self._votes.get(vid) if vid else None

    def list_by_proposal(self, proposal_id: str) -> list[Vote]:
        """Get the latest vote from each voter on a proposal."""
        latest_ids = {
            vid
            for (pid, _), vid in self._by_proposal_voter.items()
            if pid == proposal_id
        }
        return [self._votes[vid] for vid in latest_ids if vid in self._votes]

    def verify_vote(self, vote: Vote) -> bool:
        """Verify a vote's Ed25519 signature using the voter's DID public key."""
        public_key = did_to_public_key(vote.voter_did)
        return vote.verify(public_key)
