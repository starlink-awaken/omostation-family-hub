"""HITL proposal schema validation and ingress."""

from __future__ import annotations

import datetime
import hashlib
import json
import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any


class ProposalType(str, Enum):
    FAMILY_DASHBOARD_DOCUMENT_WRITE = "family_dashboard_document_write"


class ProposalOperation(str, Enum):
    REPLACE_TEXT = "replace_text"
    VACCINE_UPDATE = "vaccine_update"
    MILESTONE_ACHIEVE = "milestone_achieve"


VALID_OPERATIONS = {op.value for op in ProposalOperation}


@dataclass(frozen=True)
class ProposalSchema:
    """Validated HITL proposal schema."""

    proposal_id: str
    type: ProposalType
    operation: ProposalOperation
    target_relative: str
    expected_source_sha256: str
    expected_source_size: int
    expected_source_mode: int
    payload_ref: str
    payload_sha256: str
    change_summary: str
    risk_level: str = "L3"
    approval_required: bool = True
    auto_apply: bool = False
    created_at: str = field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    idempotency_key: str = ""

    def canonical_digest(self) -> str:
        """Compute canonical digest for idempotency/conflict detection."""
        canonical = {
            "proposal_id": self.proposal_id,
            "type": self.type.value,
            "operation": self.operation.value,
            "target_relative": self.target_relative,
            "expected_source_sha256": self.expected_source_sha256,
            "expected_source_size": self.expected_source_size,
            "expected_source_mode": self.expected_source_mode,
            "payload_ref": self.payload_ref,
            "payload_sha256": self.payload_sha256,
            "change_summary": self.change_summary,
            "risk_level": self.risk_level,
        }
        blob = json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return hashlib.sha256(blob).hexdigest()


@dataclass
class ProposalIngress:
    """Ingress result for a proposal."""

    proposal_id: str
    canonical_digest: str
    status: str  # "accepted" | "rejected" | "idempotent"
    reason: str | None = None
    existing_proposal_id: str | None = None


class ProposalValidationError(Exception):
    """Proposal validation failure."""

    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(f"[{code}] {message}")


# Allowed target path pattern: relative, no traversal, no absolute
_TARGET_PATTERN = re.compile(r"^[a-zA-Z0-9_\-][a-zA-Z0-9_\-./]*$")
_FORBIDDEN_COMPONENTS = {"..", "~", "//"}


def validate_proposal(data: dict[str, Any]) -> ProposalSchema:
    """Validate and construct a ProposalSchema from raw dict.

    Enforces T10-122 HITL mutation contract:
    - type must be family_dashboard_document_write
    - operation must be one of the three allowed
    - target must be relative, no traversal
    - risk_level L3, approval_required=true, auto_apply=false
    """
    if not isinstance(data, dict):
        raise ProposalValidationError("invalid_input", "Proposal must be a dict")

    required = [
        "proposal_id", "type", "operation", "target_relative",
        "expected_source_sha256", "expected_source_size", "expected_source_mode",
        "payload_ref", "payload_sha256", "change_summary",
    ]
    for key in required:
        if key not in data:
            raise ProposalValidationError("missing_field", f"Missing required field: {key}")

    # Type validation
    try:
        ptype = ProposalType(data["type"])
    except ValueError:
        raise ProposalValidationError("invalid_type", f"Invalid proposal type: {data['type']}")

    # Operation validation
    operation_str = data["operation"]
    if operation_str not in VALID_OPERATIONS:
        raise ProposalValidationError("invalid_operation", f"Invalid operation: {operation_str}")
    operation = ProposalOperation(operation_str)

    # Target validation: relative, no traversal
    target = data["target_relative"]

    # Check absolute path first
    if target.startswith("/"):
        raise ProposalValidationError("absolute_path", f"Target must be relative: {target}")

    # Check path traversal components
    for forbidden in _FORBIDDEN_COMPONENTS:
        if forbidden in target:
            raise ProposalValidationError("path_traversal", f"Path traversal detected: {target}")

    # Pattern match for valid characters
    if not _TARGET_PATTERN.match(target):
        raise ProposalValidationError("invalid_target", f"Invalid target path: {target}")

    # Contract enforcement
    risk_level = data.get("risk_level", "L3")
    if risk_level != "L3":
        raise ProposalValidationError("invalid_risk_level", f"Phase B requires L3, got {risk_level}")

    if not data.get("approval_required", True):
        raise ProposalValidationError("approval_not_required", "Phase B requires approval_required=true")

    if data.get("auto_apply", False):
        raise ProposalValidationError("auto_apply_enabled", "Phase B requires auto_apply=false")

    return ProposalSchema(
        proposal_id=data["proposal_id"],
        type=ptype,
        operation=operation,
        target_relative=target,
        expected_source_sha256=data["expected_source_sha256"],
        expected_source_size=data["expected_source_size"],
        expected_source_mode=data["expected_source_mode"],
        payload_ref=data["payload_ref"],
        payload_sha256=data["payload_sha256"],
        change_summary=data["change_summary"],
        risk_level=risk_level,
        approval_required=True,
        auto_apply=False,
        idempotency_key=data.get("idempotency_key", ""),
    )


def check_idempotency(
    proposal: ProposalSchema,
    existing_proposals_dir: Path,
) -> ProposalIngress:
    """Check if proposal is idempotent or conflicts with existing."""
    if not existing_proposals_dir.exists():
        return ProposalIngress(
            proposal_id=proposal.proposal_id,
            canonical_digest=proposal.canonical_digest(),
            status="accepted",
        )

    for f in existing_proposals_dir.glob("*.yaml"):
        try:
            import yaml
            with open(f) as fh:
                existing = yaml.safe_load(fh)
            if existing and existing.get("proposal_id") == proposal.proposal_id:
                existing_digest = existing.get("canonical_digest", "")
                if existing_digest == proposal.canonical_digest():
                    return ProposalIngress(
                        proposal_id=proposal.proposal_id,
                        canonical_digest=proposal.canonical_digest(),
                        status="idempotent",
                        existing_proposal_id=proposal.proposal_id,
                    )
                else:
                    return ProposalIngress(
                        proposal_id=proposal.proposal_id,
                        canonical_digest=proposal.canonical_digest(),
                        status="rejected",
                        reason="proposal_id_conflict_different_digest",
                        existing_proposal_id=proposal.proposal_id,
                    )
        except Exception:
            continue

    return ProposalIngress(
        proposal_id=proposal.proposal_id,
        canonical_digest=proposal.canonical_digest(),
        status="accepted",
    )
