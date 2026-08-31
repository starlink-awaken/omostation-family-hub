"""Tests for family-hub HITL executor."""

from __future__ import annotations

import pytest
from pathlib import Path

from family_hub.hitl.executor import (
    execute_family_dashboard_mutation,
    execute_family_dashboard_mutation_sync,
)
from family_hub.runtime.models import compute_sha256


class TestExecuteFamilyDashboardMutation:
    """Test the Agora BOS executor entry point."""

    def test_invalid_proposal_returns_error(self):
        """Invalid proposal data returns error dict."""
        result = execute_family_dashboard_mutation_sync({
            "invalid": "data",
        })
        assert result["status"] == "error"
        assert "invalid_proposal" in result["error"]

    def test_valid_proposal_executes(self, tmp_path, monkeypatch):
        """Valid proposal with correct source hash executes successfully."""
        # Setup environment
        monkeypatch.setenv("FAMILY_DOCUMENTS_ROOT", str(tmp_path / "documents"))
        monkeypatch.setenv("FAMILY_DASHBOARD_STATE_ROOT", str(tmp_path / "state"))

        # Create documents and source file
        docs = tmp_path / "documents"
        docs.mkdir(parents=True)
        source = docs / "test.md"
        source.write_text("hello world")

        # Create payload in state directory
        state = tmp_path / "state"
        state.mkdir(parents=True)
        payload_dir = state / "proposals" / "test-001"
        payload_dir.mkdir(parents=True)
        (payload_dir / "payload").write_text("hello universe")

        result = execute_family_dashboard_mutation_sync({
            "proposal_id": "test-001",
            "type": "family_dashboard_document_write",
            "operation": "replace_text",
            "target_relative": "test.md",
            "expected_source_sha256": compute_sha256(b"hello world"),
            "expected_source_size": len(b"hello world"),
            "expected_source_mode": 0o644,
            "payload_ref": "proposals/test-001/payload",
            "payload_sha256": compute_sha256(b"hello universe"),
            "change_summary": "Replace world with universe",
        })

        assert result["status"] == "ok"
        assert result["proposal_id"] == "test-001"
        assert result["receipt"]["applied"] is True
        # Verify file was written
        assert (docs / "test.md").read_text() == "hello universe"
