"""Tests for family-hub runtime planner."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from family_hub.runtime.models import (
    ManifestFile,
    GeneratedProduct,
    MigrationPlan,
    MigrationReceipt,
    MigrationStatus,
    ParityReport,
    MutationReceipt,
    compute_sha256,
    normalize_json,
)
from family_hub.runtime.planner import MigrationPlanner, MigrationError, ParityReceipt, MANIFEST_COUNT


class TestModels:
    """Test data model construction and serialization."""

    def test_compute_sha256_bytes(self):
        digest = compute_sha256(b"hello")
        assert len(digest) == 64
        assert digest == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"

    def test_compute_sha256_string(self):
        digest = compute_sha256("hello")
        assert len(digest) == 64

    def test_normalize_json_strips_volatile(self):
        data = {"name": "test", "builtAt": "2026-01-01", "value": 42}
        result = normalize_json(data)
        assert b"builtAt" not in result
        assert b"value" in result

    def test_normalize_json_deterministic(self):
        data = {"b": 2, "a": 1}
        assert normalize_json(data) == normalize_json({"a": 1, "b": 2})

    def test_manifest_file_frozen(self):
        m = ManifestFile("test.yaml", Path("/tmp/test"), "abc", 100, 0o600)
        assert m.relative_path == "test.yaml"
        with pytest.raises(AttributeError):
            m.relative_path = "other.yaml"

    def test_migration_receipt_to_dict(self):
        r = MigrationReceipt(
            receipt_id="r1",
            plan_id="p1",
            created_at="2026-08-31T00:00:00Z",
            target_root="/tmp/target",
            manifest_count=6,
            generated_count=10,
            parity_ok=True,
        )
        d = r.to_dict()
        assert d["receipt_id"] == "r1"
        assert d["manifest_count"] == 6
        assert d["parity_ok"] is True

    def test_parity_report_to_dict(self):
        r = ParityReport(
            parity_id="p1",
            created_at="2026-08-31T00:00:00Z",
            compared_count=5,
            mismatches=["a", "b"],
            ok=False,
        )
        d = r.to_dict()
        assert d["ok"] is False
        assert len(d["mismatches"]) == 2

    def test_mutation_receipt_to_dict(self):
        r = MutationReceipt(
            mutation_id="m1",
            proposal_id="p1",
            operation="replace_text",
            target="test.md",
            applied=True,
            original_sha256="abc",
            final_sha256="def",
        )
        d = r.to_dict()
        assert d["applied"] is True
        assert d["operation"] == "replace_text"


class TestMigrationPlanner:
    """Test migration planner lifecycle."""

    def _setup_documents(self, tmp_path: Path) -> Path:
        """Create a minimal documents root with manifests."""
        docs = tmp_path / "documents"
        docs.mkdir()
        manifest_dir = docs / "data-manifest"
        manifest_dir.mkdir()
        for i in range(MANIFEST_COUNT):
            (manifest_dir / f"manifest-{i}.yaml").write_text(f"manifest-{i}")
        # Add app-data with generated products
        app_data = docs / "app-data"
        app_data.mkdir()
        (app_data / "tasks.json").write_text(json.dumps({"tasks": []}))
        return docs

    def test_plan_inventory(self, tmp_path: Path):
        docs = self._setup_documents(tmp_path)
        target = tmp_path / "target"
        planner = MigrationPlanner(docs, target)
        plan = planner.plan()
        assert len(plan.manifests) == MANIFEST_COUNT
        assert plan.status == MigrationStatus.PLANNED

    def test_plan_missing_documents_root(self, tmp_path: Path):
        planner = MigrationPlanner(tmp_path / "nonexistent", tmp_path / "target")
        with pytest.raises(MigrationError) as exc_info:
            planner.plan()
        assert exc_info.value.code == "documents_root_missing"

    def test_plan_target_not_empty(self, tmp_path: Path):
        docs = self._setup_documents(tmp_path)
        target = tmp_path / "target"
        target.mkdir()
        (target / "existing.txt").write_text("data")
        planner = MigrationPlanner(docs, target)
        with pytest.raises(MigrationError) as exc_info:
            planner.plan()
        assert exc_info.value.code == "target_not_empty"

    def test_plan_wrong_manifest_count(self, tmp_path: Path):
        docs = tmp_path / "documents"
        docs.mkdir()
        manifest_dir = docs / "data-manifest"
        manifest_dir.mkdir()
        (manifest_dir / "only.yaml").write_text("only")
        planner = MigrationPlanner(docs, tmp_path / "target")
        with pytest.raises(MigrationError) as exc_info:
            planner.plan()
        assert exc_info.value.code == "manifest_count_mismatch"

    def test_full_lifecycle(self, tmp_path: Path):
        docs = self._setup_documents(tmp_path)
        target = tmp_path / "target"
        planner = MigrationPlanner(docs, target)

        # Plan
        plan = planner.plan()
        assert plan.status == MigrationStatus.PLANNED

        # Stage
        staging = planner.stage()
        assert staging.exists()
        assert planner.plan_.status == MigrationStatus.STAGING

        # Build
        planner.build(staging)
        assert planner.plan_.status == MigrationStatus.BUILDING

        # Parity
        report = planner.check_parity()
        assert report.ok is True
        assert planner.plan_.status == MigrationStatus.PARITY_OK

        # Promote
        result = planner.promote()
        assert result.exists()
        assert planner.plan_.status == MigrationStatus.PROMOTED

        # Verify
        receipt = planner.verify()
        assert receipt.parity_ok is True
        assert receipt.manifest_count == MANIFEST_COUNT
        assert planner.plan_.status == MigrationStatus.VERIFIED

    def test_rollback(self, tmp_path: Path):
        docs = self._setup_documents(tmp_path)
        target = tmp_path / "target"
        planner = MigrationPlanner(docs, target)
        planner.plan()
        planner.stage()
        planner.build(planner.plan_.staging_root)
        planner.check_parity()
        planner.promote()

        receipt = planner.rollback()
        assert receipt.rolled_back is True
        assert planner.plan_.status == MigrationStatus.ROLLED_BACK

    def test_stage_without_plan(self, tmp_path: Path):
        planner = MigrationPlanner(tmp_path / "docs", tmp_path / "target")
        with pytest.raises(MigrationError) as exc_info:
            planner.stage()
        assert exc_info.value.code == "not_planned"

    def test_promote_without_parity(self, tmp_path: Path):
        docs = self._setup_documents(tmp_path)
        planner = MigrationPlanner(docs, tmp_path / "target")
        planner.plan()
        with pytest.raises(MigrationError) as exc_info:
            planner.promote()
        assert exc_info.value.code == "parity_not_ok"
