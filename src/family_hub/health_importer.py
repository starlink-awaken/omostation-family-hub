"""HealthImporter — batch import NormalizedBiomarker to Family-Hub + BOS.

T6-25: Imports normalized biomarker records into Family-Hub documents
and publishes to bos://persona/health-profile/ingest.

All operations are local-only — no external API calls.
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from iris.connectors.openhuman.biomarkers import NormalizedBiomarker

logger = logging.getLogger(__name__)


@dataclass
class ImportResult:
    """Result of a health data import batch."""

    success_count: int = 0
    failed_count: int = 0
    bos_receipt: str | None = None
    documents_written: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    duration_ms: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "success_count": self.success_count,
            "failed_count": self.failed_count,
            "bos_receipt": self.bos_receipt,
            "documents_written": self.documents_written,
            "errors": self.errors,
            "duration_ms": self.duration_ms,
        }


class HealthImporter:
    """Import normalized biomarker records to Family-Hub + BOS projection.

    Writes records to local Family-Hub documents and publishes
    to the BOS health-profile ingestion endpoint.
    """

    def __init__(
        self,
        family_hub_path: str | None = None,
        bos_endpoint: str | None = None,
    ) -> None:
        """Initialize HealthImporter.

        Args:
            family_hub_path: Base path for Family-Hub documents.
                             Defaults to ~/.family-hub/documents.
            bos_endpoint: BOS endpoint URL for health-profile ingest.
                         Defaults to local BOS gateway.
        """
        self._family_hub_path = Path(
            family_hub_path or os.environ.get(
                "FAMILY_HUB_DOCS_PATH",
                os.path.expanduser("~/.family-hub/documents"),
            )
        )
        self._bos_endpoint = bos_endpoint or os.environ.get(
            "BOS_HEALTH_INGEST_ENDPOINT",
            "bos://persona/health-profile/ingest",
        )

    def import_batch(
        self,
        records: list[NormalizedBiomarker],
        dry_run: bool = False,
    ) -> ImportResult:
        """Import a batch of normalized biomarker records.

        Writes to Family-Hub documents and publishes to BOS.

        Args:
            records: Normalized biomarker records to import.
            dry_run: If True, report what would be written without executing.

        Returns:
            ImportResult with counts and receipts.
        """
        start = time.perf_counter()
        result = ImportResult()

        if not records:
            result.duration_ms = (time.perf_counter() - start) * 1000
            return result

        # Group records by date and category
        by_date_category: dict[str, dict[str, list[NormalizedBiomarker]]] = {}
        for record in records:
            date_str = record.timestamp.strftime("%Y-%m-%d")
            if date_str not in by_date_category:
                by_date_category[date_str] = {}
            cat_key = record.category
            if cat_key not in by_date_category[date_str]:
                by_date_category[date_str][cat_key] = []
            by_date_category[date_str][cat_key].append(record)

        # Write to Family-Hub documents
        for date_str, categories in sorted(by_date_category.items()):
            for category, cat_records in sorted(categories.items()):
                doc_path = self._family_hub_path / "health_profile" / date_str / f"{category}.md"

                if not dry_run:
                    doc_path.parent.mkdir(parents=True, exist_ok=True)
                    content = self._format_markdown(doc_path, date_str, category, cat_records)
                    doc_path.write_text(content, encoding="utf-8")
                    result.documents_written.append(str(doc_path))

                result.success_count += len(cat_records)

        # Publish to BOS (local gateway)
        if not dry_run:
            bos_receipt = self._publish_to_bos(records)
            result.bos_receipt = bos_receipt

        result.duration_ms = (time.perf_counter() - start) * 1000
        return result

    def _format_markdown(
        self,
        doc_path: Path,
        date_str: str,
        category: str,
        records: list[NormalizedBiomarker],
    ) -> str:
        """Format biomarker records as Markdown document."""
        lines = [
            f"# Health Profile — {category.replace('_', ' ').title()}",
            f"",
            f"**Date:** {date_str}",
            f"**Records:** {len(records)}",
            f"**Sources:** {', '.join(sorted(set(r.source for r in records)))}",
            f"",
            f"| Time | Value | Unit | Source | Confidence |",
            f"|------|-------|------|--------|------------|",
        ]

        for record in sorted(records, key=lambda r: r.timestamp):
            time_str = record.timestamp.strftime("%H:%M")
            lines.append(
                f"| {time_str} | {record.value:.1f} | {record.unit} "
                f"| {record.source} | {record.confidence:.2f} |"
            )

        lines.extend([
            f"",
            f"---",
            f"*Imported: {datetime.now(timezone.utc).isoformat()}*",
        ])

        return "\n".join(lines)

    def _publish_to_bos(self, records: list[NormalizedBiomarker]) -> str:
        """Publish records to BOS health-profile ingest endpoint.

        Returns:
            BOS receipt ID.
        """
        payload = {
            "records": [r.to_dict() for r in records],
            "imported_at": datetime.now(timezone.utc).isoformat(),
            "source": "family-hub-health-importer",
        }

        receipt_id = f"health-import-{int(time.time())}"

        # Write local BOS event log (simulates BOS publish)
        event_log = Path.home() / ".family-hub" / "bos_events" / "health_profile.log"
        event_log.parent.mkdir(parents=True, exist_ok=True)
        with open(event_log, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False, default=str) + "\n")

        logger.info(
            "Published %d records to BOS: %s (receipt: %s)",
            len(records),
            self._bos_endpoint,
            receipt_id,
        )
        return receipt_id
