from __future__ import annotations

import json
from pathlib import Path

import pytest

from tools.dashboard_import import (
    ImportClosedError,
    apply_import,
    derive_redaction_map,
    plan_import,
    verify_import,
    write_receipt,
)


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _minimal_source(root: Path) -> Path:
    source = root / "source"
    _write(source / "package.json", '{"private":true}\n')
    _write(source / "src" / "page.tsx", "export default function Page() {}\n")
    return source


def test_plan_selects_only_canonical_source(tmp_path: Path) -> None:
    source = _minimal_source(tmp_path)
    _write(source / "node_modules" / "ignored.js", "generated\n")
    _write(source / ".next" / "server.js", "generated\n")
    _write(source / "app-data" / "health.json", '{"private":true}\n')
    _write(source / "data-manifest" / "members.yaml", "members: []\n")
    _write(source / "src" / "app" / "data" / "tasks.json", "[]\n")
    _write(source / "public" / "tailwind.css", "generated\n")
    _write(source / "e2e" / ".auth.json", '{"cookies":[]}\n')

    plan = plan_import(source, tmp_path / "target", replacements={})

    assert [record.relative_path for record in plan.files] == [
        "package.json",
        "src/page.tsx",
    ]
    assert plan.sanitized_files == ()
    assert plan.selected_count == 2
    assert plan.excluded_counts == {
        "forbidden_name": 1,
        "runtime_or_private": 6,
    }


def test_plan_is_deterministic(tmp_path: Path) -> None:
    source = _minimal_source(tmp_path)

    first = plan_import(source, tmp_path / "target", replacements={})
    second = plan_import(source, tmp_path / "target", replacements={})

    assert first == second
    assert len(first.selected_fingerprint) == 64
    assert len(first.full_source_fingerprint) == 64


def test_plan_rejects_unknown_root_file(tmp_path: Path) -> None:
    source = _minimal_source(tmp_path)
    _write(source / "mystery.bin", "unknown\n")

    with pytest.raises(ImportClosedError, match="unknown root"):
        plan_import(source, tmp_path / "target", replacements={})


def test_plan_rejects_symlink_without_following_it(tmp_path: Path) -> None:
    source = _minimal_source(tmp_path)
    (source / "src" / "escape").symlink_to(tmp_path, target_is_directory=True)

    with pytest.raises(ImportClosedError, match="unsafe node"):
        plan_import(source, tmp_path / "target", replacements={})


def test_plan_records_but_does_not_follow_symlink_in_forbidden_cache(tmp_path: Path) -> None:
    source = _minimal_source(tmp_path)
    outside = tmp_path / "outside-secret"
    _write(outside, "must not be read\n")
    link = source / "node_modules" / ".bin" / "tool"
    link.parent.mkdir(parents=True)
    link.symlink_to(outside)

    plan = plan_import(source, tmp_path / "target", replacements={})

    assert plan.selected_count == 2
    assert plan.full_source_count == 3
    assert plan.excluded_counts == {"runtime_or_private": 1}
    assert str(outside) not in json.dumps(plan.to_public_dict())


def test_plan_separates_private_text_for_deterministic_substitution(tmp_path: Path) -> None:
    source = _minimal_source(tmp_path)
    _write(source / "src" / "member.ts", 'export const member = "Private Person";\n')

    plan = plan_import(
        source,
        tmp_path / "target",
        replacements={"Private Person": "Synthetic Member 01"},
    )

    assert [record.relative_path for record in plan.sanitized_files] == ["src/member.ts"]
    sanitized = plan.sanitized_files[0]
    assert sanitized.transform == "private-token-substitution/v1"
    assert sanitized.source_sha256 != sanitized.target_sha256
    assert "Private Person" not in json.dumps(sanitized.to_public_dict())


def test_plan_rejects_unmapped_private_token(tmp_path: Path) -> None:
    source = _minimal_source(tmp_path)
    _write(source / "src" / "member.ts", 'export const member = "Private Person";\n')

    with pytest.raises(ImportClosedError, match="unmapped private token"):
        plan_import(
            source,
            tmp_path / "target",
            replacements={"Different Private Person": "Synthetic Member 01"},
            required_private_tokens=("Private Person",),
        )


def test_derived_redaction_map_never_emits_private_values(tmp_path: Path) -> None:
    source = tmp_path / "Documents" / "family-dashboard-app"
    _write(
        source / "data-manifest" / "members.yaml",
        "members:\n  - name: Private Person\n  - name: Another Private Person\n",
    )

    result = derive_redaction_map(source)

    assert result.replacements["Another Private Person"].startswith("Synthetic Member")
    assert result.replacements["Private Person"].startswith("Synthetic Member")
    assert str(source.parent) in result.replacements
    assert "Private Person" not in json.dumps(result.public_summary)
    assert result.public_summary["replacement_count"] == 3


def test_apply_copies_exact_files_and_sanitizes_private_text(tmp_path: Path) -> None:
    source = _minimal_source(tmp_path)
    _write(source / "src" / "member.ts", 'export const member = "Private Person";\n')
    replacements = {"Private Person": "Synthetic Member 01"}
    target = tmp_path / "target"
    plan = plan_import(source, target, replacements=replacements)

    result = apply_import(plan, source, target, replacements=replacements)

    assert result.copied_files == plan.files
    assert result.sanitized_files == plan.sanitized_files
    assert (target / "src" / "page.tsx").read_bytes() == (source / "src" / "page.tsx").read_bytes()
    assert "Private Person" not in (target / "src" / "member.ts").read_text()
    assert "Synthetic Member 01" in (target / "src" / "member.ts").read_text()
    assert verify_import(plan, source, target, replacements=replacements).ok


def test_apply_rejects_source_drift_before_copy(tmp_path: Path) -> None:
    source = _minimal_source(tmp_path)
    target = tmp_path / "target"
    plan = plan_import(source, target, replacements={})
    _write(source / "src" / "page.tsx", "changed\n")

    with pytest.raises(ImportClosedError, match="source drift"):
        apply_import(plan, source, target, replacements={})

    assert not target.exists()


def test_apply_rejects_destination_collision(tmp_path: Path) -> None:
    source = _minimal_source(tmp_path)
    target = tmp_path / "target"
    target.mkdir()
    plan = plan_import(source, target, replacements={})

    with pytest.raises(ImportClosedError, match="destination collision"):
        apply_import(plan, source, target, replacements={})


def test_verify_rejects_target_extra_and_drift(tmp_path: Path) -> None:
    source = _minimal_source(tmp_path)
    target = tmp_path / "target"
    plan = plan_import(source, target, replacements={})
    apply_import(plan, source, target, replacements={})
    _write(target / "extra.ts", "unexpected\n")

    with pytest.raises(ImportClosedError, match="unexpected target path"):
        verify_import(plan, source, target, replacements={})


def test_receipt_contains_hashes_but_not_private_values(tmp_path: Path) -> None:
    source = _minimal_source(tmp_path)
    _write(source / "src" / "member.ts", 'export const member = "Private Person";\n')
    replacements = {"Private Person": "Synthetic Member 01"}
    plan = plan_import(source, tmp_path / "target", replacements=replacements)
    receipt_path = tmp_path / "receipt.json"

    write_receipt(plan, receipt_path)

    payload = receipt_path.read_text(encoding="utf-8")
    assert '"schema": "family-dashboard-import-plan/v1"' in payload
    assert "Private Person" not in payload
    assert "Synthetic Member 01" not in payload
    assert plan.redaction_map_digest in payload
