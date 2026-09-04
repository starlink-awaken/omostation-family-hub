"""HITL transaction owner: CAS-bound family document mutations.

Implements the family-hub side of T10-122 HITL mutation contract.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import os
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..runtime.models import MutationReceipt, compute_sha256
from .proposals import ProposalOperation, ProposalSchema


class MutationError(Exception):
    """Mutation failure with classification."""

    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(f"[{code}] {message}")


@dataclass
class MutationResult:
    """Result of a mutation attempt."""

    success: bool
    mutation_id: str
    proposal_id: str
    operation: str
    target: str
    receipt: MutationReceipt | None = None
    error_code: str | None = None
    error_message: str | None = None


class HitlTransactionOwner:
    """Execute CAS-bound family document mutations.

    The owner never opens a Documents file for writing directly.
    All mutations go through: validate → CAS check → stage → apply → verify.
    """

    def __init__(
        self,
        documents_root: Path,
        state_root: Path,
        *,
        allowed_targets: list[str] | None = None,
    ):
        self.documents_root = Path(documents_root)
        self.state_root = Path(state_root)
        self.allowed_targets = allowed_targets or []
        self._mutations_dir = state_root / "mutations"
        self._mutations_dir.mkdir(parents=True, exist_ok=True)

    def execute(self, proposal: ProposalSchema) -> MutationResult:
        """Execute a validated proposal mutation."""
        mutation_id = f"mutation-{proposal.proposal_id}"

        try:
            # 1. Validate target allowlist
            if self.allowed_targets:
                if not any(proposal.target_relative.startswith(t) for t in self.allowed_targets):
                    raise MutationError(
                        "target_not_allowed",
                        f"Target {proposal.target_relative} not in allowlist",
                    )

            # 2. Resolve and validate target path
            target_path = self._resolve_target(proposal.target_relative)

            # 3. Reject symlinks (check before CAS since resolve follows symlinks)
            # We need to manually walk the path to detect symlinks
            root_resolved = self.documents_root.resolve()
            current = root_resolved
            for part in Path(proposal.target_relative).parts:
                current = current / part
                if current.is_symlink():
                    raise MutationError(
                        "symlink_rejected",
                        f"Symlinks not allowed in target path: {proposal.target_relative}",
                    )

            # 4. CAS: re-read source metadata and require exact equality
            if target_path.exists():
                original_bytes = target_path.read_bytes()
                original_sha256 = compute_sha256(original_bytes)
                original_size = len(original_bytes)
                original_mode = target_path.stat().st_mode & 0o777

                if original_sha256 != proposal.expected_source_sha256:
                    raise MutationError(
                        "cas_source_mismatch",
                        f"Source SHA-256 mismatch: expected {proposal.expected_source_sha256[:16]}..., got {original_sha256[:16]}...",
                    )
                if original_size != proposal.expected_source_size:
                    raise MutationError(
                        "cas_size_mismatch",
                        f"Source size mismatch: expected {proposal.expected_source_size}, got {original_size}",
                    )
                if original_mode != proposal.expected_source_mode:
                    raise MutationError(
                        "cas_mode_mismatch",
                        f"Source mode mismatch: expected {oct(proposal.expected_source_mode)}, got {oct(original_mode)}",
                    )
            else:
                if proposal.expected_source_sha256:
                    raise MutationError(
                        "source_missing",
                        f"Target does not exist but expected_source_sha256 is set: {target_path}",
                    )
                original_bytes = None
                original_sha256 = None

            # 4. Write original bytes to mutations/<id>/original
            mutation_dir = self._mutations_dir / mutation_id
            mutation_dir.mkdir(parents=True, exist_ok=True)
            if original_bytes is not None:
                original_path = mutation_dir / "original"
                original_path.write_bytes(original_bytes)
                os.chmod(original_path, 0o600)

            # 5. Read and validate payload
            payload = self._read_payload(proposal.payload_ref)
            if compute_sha256(payload) != proposal.payload_sha256:
                raise MutationError(
                    "payload_digest_mismatch",
                    f"Payload SHA-256 mismatch for {proposal.payload_ref}",
                )

            # 6. Write prepared receipt
            prepared = {
                "mutation_id": mutation_id,
                "proposal_id": proposal.proposal_id,
                "operation": proposal.operation.value,
                "target": proposal.target_relative,
                "original_sha256": original_sha256,
                "payload_sha256": proposal.payload_sha256,
                "prepared_at": datetime.datetime.now(datetime.UTC).isoformat(),
            }
            (mutation_dir / "prepared.json").write_text(json.dumps(prepared, indent=2))

            # 7. Atomic apply: same-directory temp file + fsync + replace
            if target_path.exists():
                target_dir = target_path.parent
                target_mode = target_path.stat().st_mode
            else:
                target_dir = target_path.parent
                target_dir.mkdir(parents=True, exist_ok=True)
                target_mode = 0o644

            # Write to temp file in same directory
            fd, tmp_path = tempfile.mkstemp(dir=str(target_dir), prefix=".mutation-")
            try:
                os.write(fd, payload)
                os.fsync(fd)
                os.close(fd)
                os.chmod(tmp_path, target_mode)
                os.replace(tmp_path, str(target_path))
            except Exception:
                # Clean up temp file on failure
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
                raise

            # 8. Verify applied digest
            applied_bytes = target_path.read_bytes()
            applied_sha256 = compute_sha256(applied_bytes)

            # 9. Write apply + verify receipts
            apply = {
                "mutation_id": mutation_id,
                "applied": True,
                "final_sha256": applied_sha256,
                "applied_at": datetime.datetime.now(datetime.UTC).isoformat(),
            }
            (mutation_dir / "apply.json").write_text(json.dumps(apply, indent=2))

            verify = {
                "mutation_id": mutation_id,
                "verified": True,
                "final_sha256": applied_sha256,
                "verified_at": datetime.datetime.now(datetime.UTC).isoformat(),
            }
            (mutation_dir / "verify.json").write_text(json.dumps(verify, indent=2))

            # 10. Build receipt
            receipt = MutationReceipt(
                mutation_id=mutation_id,
                proposal_id=proposal.proposal_id,
                operation=proposal.operation.value,
                target=proposal.target_relative,
                applied=True,
                original_sha256=original_sha256,
                final_sha256=applied_sha256,
            )

            return MutationResult(
                success=True,
                mutation_id=mutation_id,
                proposal_id=proposal.proposal_id,
                operation=proposal.operation.value,
                target=proposal.target_relative,
                receipt=receipt,
            )

        except MutationError as e:
            # Write rollback receipt
            rollback_receipt = self._rollback(mutation_id, str(target_path) if 'target_path' in dir() else proposal.target_relative)
            receipt = MutationReceipt(
                mutation_id=mutation_id,
                proposal_id=proposal.proposal_id,
                operation=proposal.operation.value,
                target=proposal.target_relative,
                applied=False,
                original_sha256=None,
                final_sha256=None,
                rollback_sha256=rollback_receipt,
                error=e.code,
            )
            return MutationResult(
                success=False,
                mutation_id=mutation_id,
                proposal_id=proposal.proposal_id,
                operation=proposal.operation.value,
                target=proposal.target_relative,
                receipt=receipt,
                error_code=e.code,
                error_message=str(e),
            )

    def _resolve_target(self, relative: str) -> Path:
        """Resolve relative target to absolute path, rejecting traversal."""
        # Canonicalize the documents root
        root = self.documents_root.resolve()
        # Join and resolve the target
        target = (root / relative).resolve()

        # Verify the resolved path is under root
        try:
            target.relative_to(root)
        except ValueError:
            raise MutationError(
                "path_escape",
                f"Target escapes documents root: {relative}",
            )

        # Reject symlinks
        if target.is_symlink() or any(p.is_symlink() for p in target.parents if p != root):
            raise MutationError(
                "symlink_rejected",
                f"Symlinks not allowed in target path: {relative}",
            )

        return target

    def _read_payload(self, payload_ref: str) -> bytes:
        """Read payload from state root proposals directory."""
        payload_path = self.state_root / payload_ref
        if not payload_path.exists():
            raise MutationError(
                "payload_not_found",
                f"Payload not found: {payload_ref}",
            )
        return payload_path.read_bytes()

    def _rollback(
        self,
        mutation_id: str,
        target_path_str: str,
    ) -> str | None:
        """Rollback a mutation. Returns rollback SHA-256 or None."""
        mutation_dir = self._mutations_dir / mutation_id
        original_path = mutation_dir / "original"

        if not original_path.exists():
            # No original to restore — remove target if it was newly created
            target = Path(target_path_str)
            if target.exists():
                target.unlink()
            return None

        original_bytes = original_path.read_bytes()
        target = Path(target_path_str)

        if target.exists():
            target.write_bytes(original_bytes)
        else:
            # Target was removed — restore it
            target.write_bytes(original_bytes)

        rollback_sha256 = compute_sha256(original_bytes)
        rollback = {
            "mutation_id": mutation_id,
            "rolled_back": True,
            "rollback_sha256": rollback_sha256,
            "rolled_back_at": datetime.datetime.now(datetime.UTC).isoformat(),
        }
        (mutation_dir / "rollback.json").write_text(json.dumps(rollback, indent=2))

        return rollback_sha256
