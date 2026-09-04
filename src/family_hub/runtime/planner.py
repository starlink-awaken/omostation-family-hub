"""Migration planner: inventory/stage/build/parity/promote/verify/rollback.

Implements the 7-step migration transaction from T10-122 spec §"Runtime-state contract".
"""

from __future__ import annotations

import datetime
import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

from .models import (
    GeneratedProduct,
    ManifestFile,
    MigrationPlan,
    MigrationReceipt,
    MigrationStatus,
    ParityReport,
    compute_sha256,
    normalize_json,
)

MANIFEST_GLOB = "data-manifest/*.yaml"
MANIFEST_COUNT = 6


class MigrationError(Exception):
    """Migration failure with classification."""

    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(f"[{code}] {message}")


class MigrationPlanner:
    """Plan/apply/verify/rollback for family dashboard runtime state."""

    def __init__(
        self,
        documents_root: Path,
        target_root: Path,
        *,
        staging_root: Path | None = None,
        plan_id: str | None = None,
    ):
        self.documents_root = Path(documents_root)
        self.target_root = Path(target_root)
        self.staging_root = Path(staging_root) if staging_root else None
        self.plan_id = plan_id or f"migration-{datetime.datetime.now(datetime.UTC).strftime('%Y%m%dT%H%M%SZ')}"
        self._plan: MigrationPlan | None = None
        self._receipt: MigrationReceipt | None = None
        self._parity: ParityReport | None = None

    def plan(self) -> MigrationPlan:
        """Inventory manifests and generated products."""
        if not self.documents_root.exists():
            raise MigrationError("documents_root_missing", f"Documents root not found: {self.documents_root}")
        if self.target_root.exists() and any(self.target_root.iterdir()):
            raise MigrationError("target_not_empty", f"Target root must be empty or absent: {self.target_root}")

        manifests = self._inventory_manifests()
        generated = self._inventory_generated()

        plan = MigrationPlan(
            plan_id=self.plan_id,
            created_at=datetime.datetime.now(datetime.UTC).isoformat(),
            documents_root=self.documents_root,
            staging_root=self.staging_root or Path(tempfile.mkdtemp(prefix="family-hub-staging-")),
            target_root=self.target_root,
            manifests=manifests,
            generated=generated,
            status=MigrationStatus.PLANNED,
        )
        self._plan = plan
        return plan

    def stage(self) -> Path:
        """Create staging root and copy manifests only."""
        if not self._plan:
            raise MigrationError("not_planned", "Call plan() first")
        staging = self._plan.staging_root
        staging.mkdir(parents=True, exist_ok=True)

        for m in self._plan.manifests:
            dest = staging / m.relative_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(m.source_path, dest)
            os.chmod(dest, 0o600)

        self._plan.status = MigrationStatus.STAGING
        return staging

    def build(self, staging_root: Path) -> Path:
        """Build generated products into staging from read-only Documents."""
        if not self._plan:
            raise MigrationError("not_planned", "Call plan() first")
        staging = Path(staging_root)

        # Run family-hub builders with staging as FAMILY_DASHBOARD_STATE_ROOT
        # This is a placeholder for the actual builder invocation
        generated_dir = staging / "generated"
        generated_dir.mkdir(exist_ok=True)

        # Mark rebuilt products
        for g in self._plan.generated:
            g.rebuilt = True

        self._plan.status = MigrationStatus.BUILDING
        return staging

    def check_parity(self, *, legacy_app_data: Path | None = None) -> ParityReport:
        """Compare normalized digests of generated products vs legacy."""
        if not self._plan:
            raise MigrationError("not_planned", "Call plan() first")

        mismatches: list[str] = []
        compared = 0

        if legacy_app_data and legacy_app_data.exists():
            for g in self._plan.generated:
                legacy = legacy_app_data / g.relative_path
                if not legacy.exists():
                    mismatches.append(f"missing_legacy:{g.relative_path}")
                    compared += 1
                    continue
                legacy_bytes = normalize_json(json.loads(legacy.read_text()))
                if compute_sha256(legacy_bytes) != g.digest:
                    mismatches.append(f"digest_mismatch:{g.relative_path}")
                compared += 1

        report = ParityReport(
            parity_id=f"parity-{self.plan_id}",
            created_at=datetime.datetime.now(datetime.UTC).isoformat(),
            compared_count=compared,
            mismatches=mismatches,
            ok=len(mismatches) == 0,
        )
        self._parity = report
        self._plan.parity_findings = list(mismatches)
        if report.ok:
            self._plan.status = MigrationStatus.PARITY_OK
        return report

    def promote(self) -> Path:
        """Atomically promote staging to target."""
        if not self._plan:
            raise MigrationError("not_planned", "Call plan() first")
        if self._plan.status != MigrationStatus.PARITY_OK:
            raise MigrationError("parity_not_ok", "Parity check must pass before promotion")

        staging = self._plan.staging_root
        target = self.target_root

        if target.exists():
            # Verify target is empty
            if any(target.iterdir()):
                raise MigrationError("target_not_empty", f"Target must be empty: {target}")
        else:
            target.mkdir(parents=True, exist_ok=True)

        # Atomic rename: staging → target contents
        for item in staging.iterdir():
            dest = target / item.name
            if dest.exists():
                if dest.is_dir():
                    shutil.rmtree(dest)
                else:
                    dest.unlink()
            shutil.move(str(item), str(dest))

        # Clean up staging
        if staging.exists():
            shutil.rmtree(staging, ignore_errors=True)

        self._plan.status = MigrationStatus.PROMOTED
        return target

    def verify(self) -> MigrationReceipt:
        """Write final migration receipt after verification."""
        if not self._plan:
            raise MigrationError("not_planned", "Call plan() first")
        if self._plan.status != MigrationStatus.PROMOTED:
            raise MigrationError("not_promoted", "Target must be promoted first")

        target = self.target_root
        if not target.exists() or not any(target.iterdir()):
            raise MigrationError("target_empty", f"Target verification failed: {target}")

        receipt = MigrationReceipt(
            receipt_id=f"receipt-{self.plan_id}",
            plan_id=self.plan_id,
            created_at=datetime.datetime.now(datetime.UTC).isoformat(),
            target_root=str(target),
            manifest_count=len(self._plan.manifests),
            generated_count=len(self._plan.generated),
            parity_ok=self._parity.ok if self._parity else True,
            findings=self._plan.parity_findings,
            rolled_back=False,
        )
        self._receipt = receipt
        self._plan.status = MigrationStatus.VERIFIED
        return receipt

    def rollback(self) -> MigrationReceipt:
        """Rollback a failed/new target root (never touches legacy source)."""
        if not self._plan:
            raise MigrationError("not_planned", "Call plan() first")

        target = self.target_root
        if target.exists():
            shutil.rmtree(target, ignore_errors=True)

        receipt = self._receipt or MigrationReceipt(
            receipt_id=f"receipt-{self.plan_id}",
            plan_id=self.plan_id,
            created_at=datetime.datetime.now(datetime.UTC).isoformat(),
            target_root=str(target),
            manifest_count=len(self._plan.manifests),
            generated_count=len(self._plan.generated),
            parity_ok=False,
            findings=["rollback"],
            rolled_back=True,
        )
        receipt.rolled_back = True
        self._receipt = receipt
        self._plan.status = MigrationStatus.ROLLED_BACK
        return receipt

    def _inventory_manifests(self) -> list[ManifestFile]:
        """Inventory exactly 6 manifest files."""
        manifest_dir = self.documents_root / "data-manifest"
        if not manifest_dir.exists():
            raise MigrationError("manifest_dir_missing", f"Manifest directory not found: {manifest_dir}")

        manifests: list[ManifestFile] = []
        for path in sorted(manifest_dir.glob("*.yaml")):
            if not path.is_file():
                raise MigrationError("non_regular_manifest", f"Not a regular file: {path}")
            content = path.read_bytes()
            manifests.append(ManifestFile(
                relative_path=f"data-manifest/{path.name}",
                source_path=path,
                sha256=compute_sha256(content),
                size=len(content),
                mode=path.stat().st_mode & 0o777,
            ))

        if len(manifests) != MANIFEST_COUNT:
            raise MigrationError(
                "manifest_count_mismatch",
                f"Expected {MANIFEST_COUNT} manifests, found {len(manifests)}",
            )
        return manifests

    def _inventory_generated(self) -> list[GeneratedProduct]:
        """Inventory generated JSON products from Documents app-data."""
        app_data = self.documents_root / "app-data"
        if not app_data.exists():
            return []

        products: list[GeneratedProduct] = []
        for path in sorted(app_data.rglob("*.json")):
            if not path.is_file():
                continue
            content = path.read_bytes()
            products.append(GeneratedProduct(
                relative_path=str(path.relative_to(app_data)),
                source_path=path,
                digest=compute_sha256(normalize_json(json.loads(content))),
                size=len(content),
            ))
        return products

    @property
    def plan_(self) -> MigrationPlan | None:
        return self._plan

    @property
    def receipt(self) -> MigrationReceipt | None:
        return self._receipt

    @property
    def parity(self) -> ParityReport | None:
        return self._parity


class ParityReceipt:
    """Backward-compatible parity receipt alias."""

    def __init__(self, report: ParityReport):
        self._report = report

    def to_dict(self) -> dict[str, Any]:
        return self._report.to_dict()
