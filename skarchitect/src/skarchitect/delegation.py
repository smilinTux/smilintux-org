"""Liquid republic delegation with cycle detection."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from skarchitect.categories import ProposalCategory
from skarchitect.models import Delegation


class DelegationStore:
    """In-memory delegation store for SDK use."""

    def __init__(self) -> None:
        self._delegations: dict[str, Delegation] = {}
        # Index: (delegator_did, category) → delegation_id
        self._by_delegator: dict[tuple[str, Optional[str]], str] = {}

    def delegate(
        self,
        delegator_did: str,
        delegate_did: str,
        category: Optional[ProposalCategory] = None,
    ) -> Delegation:
        """Create or update a delegation. Checks for cycles."""
        if delegator_did == delegate_did:
            raise ValueError("Cannot delegate to yourself")

        # Check for cycles
        if self._would_create_cycle(delegator_did, delegate_did, category):
            raise ValueError(
                f"Delegation would create a cycle: {delegator_did} → {delegate_did}"
            )

        cat_key = category.value if category else None
        existing_id = self._by_delegator.get((delegator_did, cat_key))

        if existing_id and existing_id in self._delegations:
            # Deactivate old delegation
            self._delegations[existing_id].active = False

        delegation = Delegation(
            delegator_did=delegator_did,
            delegate_did=delegate_did,
            category=category,
        )
        self._delegations[delegation.delegation_id] = delegation
        self._by_delegator[(delegator_did, cat_key)] = delegation.delegation_id
        return delegation

    def revoke(self, delegation_id: str) -> None:
        """Revoke a delegation."""
        delegation = self._delegations.get(delegation_id)
        if not delegation:
            raise KeyError(f"Delegation not found: {delegation_id}")
        delegation.active = False
        delegation.updated_at = datetime.now(timezone.utc)

    def get_delegate(
        self, delegator_did: str, category: Optional[ProposalCategory] = None
    ) -> Optional[str]:
        """Get the active delegate for a national in a category.

        Falls back to global delegation if no category-specific one exists.
        """
        cat_key = category.value if category else None

        # Check category-specific first
        if cat_key:
            did = self._resolve_delegate(delegator_did, cat_key)
            if did:
                return did

        # Fall back to global
        return self._resolve_delegate(delegator_did, None)

    def resolve_chain(
        self, delegator_did: str, category: Optional[ProposalCategory] = None
    ) -> list[str]:
        """Resolve the full delegation chain from delegator to final delegate.

        Returns list of DIDs in chain order (excluding the original delegator).
        """
        chain: list[str] = []
        visited: set[str] = {delegator_did}
        current = delegator_did

        while True:
            delegate = self.get_delegate(current, category)
            if not delegate or delegate in visited:
                break
            chain.append(delegate)
            visited.add(delegate)
            current = delegate

        return chain

    def get_delegators(
        self, delegate_did: str, category: Optional[ProposalCategory] = None
    ) -> list[str]:
        """Get all nationals who have delegated to this delegate."""
        cat_key = category.value if category else None
        delegators = []
        for d in self._delegations.values():
            if not d.active or d.delegate_did != delegate_did:
                continue
            d_cat = d.category.value if d.category else None
            if cat_key is None or d_cat is None or d_cat == cat_key:
                delegators.append(d.delegator_did)
        return delegators

    def list_by_delegator(self, delegator_did: str) -> list[Delegation]:
        return [
            d
            for d in self._delegations.values()
            if d.delegator_did == delegator_did and d.active
        ]

    def _resolve_delegate(self, delegator_did: str, cat_key: Optional[str]) -> Optional[str]:
        did = self._by_delegator.get((delegator_did, cat_key))
        if did and did in self._delegations:
            d = self._delegations[did]
            if d.active:
                return d.delegate_did
        return None

    def _would_create_cycle(
        self,
        delegator_did: str,
        delegate_did: str,
        category: Optional[ProposalCategory],
    ) -> bool:
        """Check if adding this delegation would create a cycle."""
        visited: set[str] = {delegator_did}
        current = delegate_did

        while current:
            if current in visited:
                return True
            visited.add(current)
            current = self.get_delegate(current, category)

        return False
