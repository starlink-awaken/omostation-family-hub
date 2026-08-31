"""Tests for family-hub HITL transaction owner."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from family_hub.hitl.proposals import (
    ProposalSchema,
    ProposalType,
    ProposalOperation,
    ProposalValidationError,
    validate_proposal,
    _TARGET_PATTERN,
)
from family_hub.hitl.owner import HitlTransactionOwner, MutationError
from family_hub.runtime.models import compute_sha256


def compute_sha3(content):
    """Helper to compute sha256 for test data."""
    if isinstance(content, str):
        content = content.encode("utf-8")
    return compute_sha256(content)


class TestProposalValidation:
    """Test proposal schema validation."""

    def _minimal_proposal(self, **overrides) -> dict:
        data = {
            "proposal_id": "test-001",
            "type": "family_dashboard_document_write",
            "operation": "replace_text",
            "target_relative": "test-doc.md",
            "expected_source_sha256": compute_sha3(b"source"),
            "expected_source_size": 6,
            "expected_source_mode": 0o644,
            "payload_ref": "proposals/test-001/payload",
            "payload_sha256": compute_sha3(b"payload"),
            "change_summary": "Test change",
        }
        data.update(overrides)
        return data

    def test_valid_proposal(self):
        data = self._minimal_proposal()
        schema = validate_proposal(data)
        assert schema.proposal_id == "test-001"
        assert schema.type == ProposalType.FAMILY_DASHBOARD_DOCUMENT_WRITE
        assert schema.operation == ProposalOperation.REPLACE_TEXT

    def test_missing_required_field(self):
        data = self._minimal_proposal()
        del data["change_summary"]
        with pytest.raises(ProposalValidationError) as exc_info:
            validate_proposal(data)
        assert "missing_field" in str(exc_info.value.code)

    def test_invalid_type(self):
        data = self._minimal_proposal(type="invalid")
        with pytest.raises(ProposalValidationError):
            validate_proposal(data)

    def test_invalid_operation(self):
        data = self._minimal_proposal(operation="delete")
        with pytest.raises(ProposalValidationError):
            validate_proposal(data)

    def test_path_traversal(self):
        data = self._minimal_proposal(target_relative="../etc/passwd")
        with pytest.raises(ProposalValidationError) as exc_info:
            validate_proposal(data)
        assert exc_info.value.code == "path_traversal"

    def test_absolute_path_rejected(self):
        data = self._minimal_proposal(target_relative="/etc/passwd")
        with pytest.raises(ProposalValidationError) as exc_info:
            validate_proposal(data)
        assert exc_info.value.code == "absolute_path"

    def test_wrong_risk_level(self):
        data = self._minimal_proposal(risk_level="L1")
        with pytest.raises(ProposalValidationError) as exc_info:
            validate_proposal(data)
        assert "risk_level" in exc_info.value.code

    def test_approval_not_required(self):
        data = self._minimal_proposal(approval_required=False)
        with pytest.raises(ProposalValidationError) as exc_info:
            validate_proposal(data)
        assert "approval_not_required" in exc_info.value.code

    def test_auto_apply_enabled(self):
        data = self._minimal_proposal(auto_apply=True)
        with pytest.raises(ProposalValidationError) as exc_info:
            validate_proposal(data)
        assert "auto_apply_enabled" in exc_info.value.code

    def test_canonical_digest_stable(self):
        data = self._minimal_proposal()
        schema1 = validate_proposal(data)
        schema2 = validate_proposal(data)
        assert schema1.canonical_digest() == schema2.canonical_digest()


class TestHitlTransactionOwner:
    """Test HITL transaction owner execution."""

    def _setup_env(self, tmp_path: Path) -> tuple[Path, Path]:
        """Create minimal environment for testing."""
        docs = tmp_path / "documents"
        docs.mkdir()
        state = tmp_path / "state"
        state.mkdir()
        proposals_dir = state / "proposals" / "test-001"
        proposals_dir.mkdir(parents=True)
        return docs, state

    def _create_source_and_payload(self, docs: Path, state: Path):
        """Create source document and payload."""
        source = docs / "test-doc.md"
        source.write_text("hello world")
        payload_dir = state / "proposals" / "test-001"
        payload_dir.mkdir(parents=True, exist_ok=True)
        payload = payload_dir / "payload"
        payload.write_text("hello universe")
        return source, payload

    def _make_proposal(self, docs: Path, state: Path) -> ProposalSchema:
        """Create a valid proposal for testing."""
        source, payload = self._create_source_and_payload(docs, state)
        return validate_proposal({
            "proposal_id": "test-001",
            "type": "family_dashboard_document_write",
            "operation": "replace_text",
            "target_relative": "test-doc.md",
            "expected_source_sha256": compute_sha3(b"hello world"),
            "expected_source_size": len(b"hello world"),
            "expected_source_mode": source.stat().st_mode & 0o777,
            "payload_ref": "proposals/test-001/payload",
            "payload_sha256": compute_sha3(b"hello universe"),
            "change_summary": "Replace world with universe",
        })

    def test_execute_success(self, tmp_path: Path):
        docs, state = self._setup_env(tmp_path)
        proposal = self._make_proposal(docs, state)
        owner = HitlTransactionOwner(docs, state)
        result = owner.execute(proposal)
        assert result.success is True
        assert result.receipt.applied is True
        assert (docs / "test-doc.md").read_text() == "hello universe"

    def test_execute_cas_mismatch(self, tmp_path: Path):
        docs, state = self._setup_env(tmp_path)
        source, payload = self._create_source_and_payload(docs, state)
        # Modify source after proposal
        source.write_text("modified content")
        proposal = validate_proposal({
            "proposal_id": "test-002",
            "type": "family_dashboard_document_write",
            "operation": "replace_text",
            "target_relative": "test-doc.md",
            "expected_source_sha256": compute_sha3(b"hello world"),  # Old hash
            "expected_source_size": len(b"hello world"),
            "expected_source_mode": 0o644,
            "payload_ref": "proposals/test-001/payload",
            "payload_sha256": compute_sha3(b"hello universe"),
            "change_summary": "Should fail CAS",
        })
        owner = HitlTransactionOwner(docs, state)
        result = owner.execute(proposal)
        assert result.success is False
        assert result.error_code == "cas_source_mismatch"

    def test_execute_payload_digest_mismatch(self, tmp_path: Path):
        docs, state = self._setup_env(tmp_path)
        source, payload = self._create_source_and_payload(docs, state)
        proposal = validate_proposal({
            "proposal_id": "test-003",
            "type": "family_dashboard_document_write",
            "operation": "replace_text",
            "target_relative": "test-doc.md",
            "expected_source_sha256": compute_sha3(b"hello world"),
            "expected_source_size": len(b"hello world"),
            "expected_source_mode": source.stat().st_mode & 0o777,
            "payload_ref": "proposals/test-001/payload",
            "payload_sha256": "wrong_digest",  # Wrong
            "change_summary": "Should fail payload",
        })
        owner = HitlTransactionOwner(docs, state)
        result = owner.execute(proposal)
        assert result.success is False
        assert result.error_code == "payload_digest_mismatch"

    def test_rollback_creates_receipt(self, tmp_path: Path):
        docs, state = self._setup_env(tmp_path)
        proposal = self._make_proposal(docs, state)
        owner = HitlTransactionOwner(docs, state)
        # First execute
        result = owner.execute(proposal)
        assert result.success is True
        # Verify receipt file exists
        mutation_dir = state / "mutations" / f"mutation-{proposal.proposal_id}"
        assert (mutation_dir / "apply.json").exists()
        assert (mutation_dir / "verify.json").exists()

    def test_symlink_rejected(self, tmp_path: Path):
        """Symlink within documents root is rejected."""
        docs, state = self._setup_env(tmp_path)
        # Create a regular file and a symlink to it (both within docs root)
        real_file = docs / "real.txt"
        real_file.write_text("real")
        symlink = docs / "link.txt"
        symlink.symlink_to(real_file)
        # Create payload in correct location: state/proposals/test-001/payload
        payload_dir = state / "proposals" / "test-001"
        payload_dir.mkdir(parents=True, exist_ok=True)
        (payload_dir / "payload").write_text("new content")
        proposal = validate_proposal({
            "proposal_id": "test-004",
            "type": "family_dashboard_document_write",
            "operation": "replace_text",
            "target_relative": "link.txt",
            "expected_source_sha256": compute_sha3(b"real"),
            "expected_source_size": 4,
            "expected_source_mode": real_file.stat().st_mode & 0o777,
            "payload_ref": "proposals/test-001/payload",
            "payload_sha256": compute_sha3(b"new content"),
            "change_summary": "Should reject symlink",
        })
        owner = HitlTransactionOwner(docs, state)
        result = owner.execute(proposal)
        assert result.success is False
        assert result.error_code == "symlink_rejected"

    def test_path_traversal_rejected_in_proposal(self, tmp_path: Path):
        """Path traversal with .. is caught at proposal validation."""
        with pytest.raises(ProposalValidationError) as exc_info:
            validate_proposal({
                "proposal_id": "test-005",
                "type": "family_dashboard_document_write",
                "operation": "replace_text",
                "target_relative": "subdir/../../etc/passwd",
                "expected_source_sha256": "abc",
                "expected_source_size": 0,
                "expected_source_mode": 0o644,
                "payload_ref": "proposals/test-001/payload",
                "payload_sha256": compute_sha3(b"x"),
                "change_summary": "Should reject path traversal",
            })
        assert "traversal" in exc_info.value.code

    def test_execute_source_missing(self, tmp_path: Path):
        """Mutation fails when source document doesn't exist."""
        docs, state = self._setup_env(tmp_path)
        proposal = validate_proposal({
            "proposal_id": "test-006",
            "type": "family_dashboard_document_write",
            "operation": "replace_text",
            "target_relative": "nonexistent.md",
            "expected_source_sha256": "",  # No source expected (new file)
            "expected_source_size": 0,
            "expected_source_mode": 0o644,
            "payload_ref": "proposals/test-001/payload",
            "payload_sha256": compute_sha3(b"hello universe"),
            "change_summary": "Create new file",
        })
        owner = HitlTransactionOwner(docs, state)
        result = owner.execute(proposal)
        assert result.success is False
