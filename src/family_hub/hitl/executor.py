"""HITL executor entry point for Agora BOS route.

This module is the target of:
  bos://governance/hitl/execute/family_dashboard_document_write

The Agora BOS resolver imports this module via importlib and calls
`execute_family_dashboard_mutation(args, proxy_manager)`.

Note: In Phase B, this is a thin wrapper around HitlTransactionOwner.
The actual Documents write happens through CAS-bound atomic operations.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any

from .owner import HitlTransactionOwner
from .proposals import validate_proposal


async def execute_family_dashboard_mutation(
    args: dict | None = None,
    proxy_manager: Any | None = None,
) -> dict:
    """Execute a family-dashboard document mutation from an approved HITL proposal.

    Called by Agora BOS resolver when
    bos://governance/hitl/execute/family_dashboard_document_write is invoked.

    Args:
        args: Proposal data from the BOS call
        proxy_manager: Agora proxy manager (unused in Phase B)

    Returns:
        dict with mutation result and receipt reference
    """
    args = args or {}

    # Determine roots from environment
    documents_root = Path(
        os.environ.get("FAMILY_DOCUMENTS_ROOT", str(Path.home() / "Documents" / "@家庭生活"))
    )
    state_root = Path(
        os.environ.get("FAMILY_DASHBOARD_STATE_ROOT", str(Path.home() / "Workspace" / "runtime" / "family-hub" / "dashboard"))
    )

    # Validate proposal
    try:
        proposal = validate_proposal(args)
    except Exception as e:
        return {"status": "error", "error": f"invalid_proposal: {e}"}

    # Execute via owner
    owner = HitlTransactionOwner(documents_root, state_root)
    result = owner.execute(proposal)

    return {
        "status": "ok" if result.success else "failed",
        "mutation_id": result.mutation_id,
        "proposal_id": result.proposal_id,
        "operation": result.operation,
        "target": result.target,
        "receipt": result.receipt.to_dict() if result.receipt else None,
        "error": result.error_message,
    }


def execute_family_dashboard_mutation_sync(
    args: dict | None = None,
    proxy_manager: Any | None = None,
) -> dict:
    """Sync wrapper for execute_family_dashboard_mutation."""
    return asyncio.run(execute_family_dashboard_mutation(args, proxy_manager))
