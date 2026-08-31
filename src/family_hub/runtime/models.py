"""Runtime state data models."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any


class MigrationStatus(str, Enum):
    PLANNED = "planned"
    STAGING = "staging"
    BUILDING = "building"
    PARITY_OK = "parity_ok"
    PROMOTED = "promoted"
    VERIFIED = "verified"
    ROLLED_BACK = "rolled_back"
    FAILED = "failed"


@dataclass(frozen=True)
class ManifestFile:
    """A single manifest file to migrate."""

    relative_path: str
    source_path: Path
    sha256: str
    size: int
    mode: int


@dataclass
class GeneratedProduct:
    """A generated product rebuilt during staging."""

    relative_path: str
    source_path: Path | None
    digest: str
    size: int
    rebuilt: bool = True


@dataclass
class MigrationPlan:
    """Complete migration plan before execution."""

    plan_id: str
    created_at: str
    documents_root: Path
    staging_root: Path
    target_root: Path
    manifests: list[ManifestFile] = field(default_factory=list)
    generated: list[GeneratedProduct] = field(default_factory=list)
    parity_findings: list[str] = field(default_factory=list)
    status: MigrationStatus = MigrationStatus.PLANNED
    error: str | None = None


@dataclass
class MigrationReceipt:
    """Immutable migration receipt written after verification."""

    receipt_id: str
    plan_id: str
    created_at: str
    target_root: str
    manifest_count: int
    generated_count: int
    parity_ok: bool
    findings: list[str] = field(default_factory=list)
    rolled_back: bool = False
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "receipt_id": self.receipt_id,
            "plan_id": self.plan_id,
            "created_at": self.created_at,
            "target_root": self.target_root,
            "manifest_count": self.manifest_count,
            "generated_count": self.generated_count,
            "parity_ok": self.parity_ok,
            "findings": list(self.findings),
            "rolled_back": self.rolled_back,
            "error": self.error,
        }


@dataclass
class ParityReport:
    """Normalized parity comparison result."""

    parity_id: str
    created_at: str
    compared_count: int
    mismatches: list[str] = field(default_factory=list)
    ok: bool = True

    def to_dict(self) -> dict[str, Any]:
        return {
            "parity_id": self.parity_id,
            "created_at": self.created_at,
            "compared_count": self.compared_count,
            "mismatches": list(self.mismatches),
            "ok": self.ok,
        }


@dataclass
class MutationReceipt:
    """Receipt for a single HITL document mutation."""

    mutation_id: str
    proposal_id: str
    operation: str
    target: str
    applied: bool
    original_sha256: str | None = None
    final_sha256: str | None = None
    rollback_sha256: str | None = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "mutation_id": self.mutation_id,
            "proposal_id": self.proposal_id,
            "operation": self.operation,
            "target": self.target,
            "applied": self.applied,
            "original_sha256": self.original_sha256,
            "final_sha256": self.final_sha256,
            "rollback_sha256": self.rollback_sha256,
            "created_at": self.created_at,
            "error": self.error,
        }


def compute_sha256(content: bytes | str) -> str:
    """Compute SHA-256 digest of bytes or string."""
    if isinstance(content, str):
        content = content.encode("utf-8")
    return hashlib.sha256(content).hexdigest()


def normalize_json(data: Any) -> bytes:
    """Normalize JSON for deterministic comparison (ignore volatile fields)."""
    volatile_fields = {"builtAt", "build-meta.builtAt", "generatedAt", "timestamp"}

    def _strip(obj: Any) -> Any:
        if isinstance(obj, dict):
            return {k: _strip(v) for k, v in obj.items() if k not in volatile_fields}
        if isinstance(obj, list):
            return [_strip(v) for v in obj]
        return obj

    normalized = _strip(data)
    return json.dumps(normalized, sort_keys=True, separators=(",", ":")).encode("utf-8")
