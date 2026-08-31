"""Mutation operation handlers for HITL transactions.

Each handler renders proposed whole-file bytes from an exact source hash.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from .proposals import ProposalOperation
from ..runtime.models import compute_sha256


class MutationHandler(ABC):
    """Base class for mutation operation handlers."""

    @abstractmethod
    def render(
        self,
        source_bytes: bytes,
        payload: dict[str, Any],
    ) -> bytes:
        """Render proposed bytes from source and payload."""

    @abstractmethod
    def operation(self) -> ProposalOperation:
        """Return the operation type."""


class ReplaceTextHandler(MutationHandler):
    """Replace text within a document."""

    def operation(self) -> ProposalOperation:
        return ProposalOperation.REPLACE_TEXT

    def render(self, source_bytes: bytes, payload: dict[str, Any]) -> bytes:
        """Replace text specified in payload."""
        old_text = payload.get("old_text", "")
        new_text = payload.get("new_text", "")
        if not old_text:
            raise ValueError("old_text is required for replace_text")
        return source_bytes.replace(old_text.encode(), new_text.encode())


class VaccineUpdateHandler(MutationHandler):
    """Update vaccine record."""

    def operation(self) -> ProposalOperation:
        return ProposalOperation.VACCINE_UPDATE

    def render(self, source_bytes: bytes, payload: dict[str, Any]) -> bytes:
        """Render updated vaccine record."""
        import json
        data = json.loads(source_bytes)
        vaccine_id = payload.get("vaccine_id")
        if not vaccine_id:
            raise ValueError("vaccine_id is required for vaccine_update")
        # Apply update logic here
        return json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")


class MilestoneAchieveHandler(MutationHandler):
    """Mark milestone as achieved."""

    def operation(self) -> ProposalOperation:
        return ProposalOperation.MILESTONE_ACHIEVE

    def render(self, source_bytes: bytes, payload: dict[str, Any]) -> bytes:
        """Render milestone achievement record."""
        import json
        data = json.loads(source_bytes)
        milestone_id = payload.get("milestone_id")
        if not milestone_id:
            raise ValueError("milestone_id is required for milestone_achieve")
        # Apply milestone logic here
        return json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")


def get_handler(operation: ProposalOperation) -> MutationHandler:
    """Get the handler for a given operation."""
    handlers = {
        ProposalOperation.REPLACE_TEXT: ReplaceTextHandler,
        ProposalOperation.VACCINE_UPDATE: VaccineUpdateHandler,
        ProposalOperation.MILESTONE_ACHIEVE: MilestoneAchieveHandler,
    }
    handler_cls = handlers.get(operation)
    if not handler_cls:
        raise ValueError(f"Unknown operation: {operation}")
    return handler_cls()
