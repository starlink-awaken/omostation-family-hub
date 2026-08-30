from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from tools.dashboard_import import (
    ImportClosedError,
    _iter_adapted_target_files,
    apply_import,
    derive_redaction_map,
    plan_import,
    verify_adapted_import,
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


def test_plan_binds_redacted_source_and_target_root_identities(tmp_path: Path) -> None:
    source = _minimal_source(tmp_path)
    target = tmp_path / "target"

    plan = plan_import(
        source,
        target,
        replacements={},
        source_root_ref="documents://family-dashboard-app",
        target_root_ref="repo://family-hub/apps/dashboard",
    )

    assert plan.source_root_identity.ref == "documents://family-dashboard-app"
    assert plan.target_root_identity.ref == "repo://family-hub/apps/dashboard"
    assert len(plan.source_root_identity.path_digest) == 64
    assert len(plan.target_root_identity.path_digest) == 64
    public = json.dumps(plan.to_public_dict(), sort_keys=True)
    assert str(tmp_path) not in public
    assert len(plan.expected_target_fingerprint) == 64


def test_apply_rejects_byte_identical_wrong_source_and_target_roots(tmp_path: Path) -> None:
    source = _minimal_source(tmp_path / "approved")
    target_owner = tmp_path / "approved-target"
    target = target_owner / "apps" / "dashboard"
    plan = plan_import(
        source,
        target,
        replacements={},
        source_root_ref="documents://family-dashboard-app",
        target_root_ref="repo://family-hub/apps/dashboard",
        target_owner_root=target_owner,
    )

    wrong_source = tmp_path / "wrong" / source.name
    shutil.copytree(source, wrong_source)
    with pytest.raises(ImportClosedError, match="source root identity mismatch"):
        apply_import(
            plan,
            wrong_source,
            target,
            replacements={},
            source_root_ref="documents://family-dashboard-app",
            target_root_ref="repo://family-hub/apps/dashboard",
            target_owner_root=target_owner,
        )

    wrong_target = tmp_path / "wrong-target" / "apps" / "dashboard"
    with pytest.raises(ImportClosedError, match="target root"):
        apply_import(
            plan,
            source,
            wrong_target,
            replacements={},
            source_root_ref="documents://family-dashboard-app",
            target_root_ref="repo://family-hub/apps/dashboard",
            target_owner_root=target_owner,
        )
    assert not wrong_target.exists()


def test_target_identity_is_stable_across_clean_clone_roots(tmp_path: Path) -> None:
    source = _minimal_source(tmp_path)
    first_owner = tmp_path / "clone-a"
    second_owner = tmp_path / "clone-b"
    first = plan_import(
        source,
        first_owner / "apps" / "dashboard",
        replacements={},
        target_owner_root=first_owner,
    )
    second = plan_import(
        source,
        second_owner / "apps" / "dashboard",
        replacements={},
        target_owner_root=second_owner,
    )

    assert first.target_root_identity == second.target_root_identity


def test_adapted_target_fingerprint_excludes_self_referential_receipts(tmp_path: Path) -> None:
    target = tmp_path / "apps" / "dashboard"
    _write(target / "src" / "page.tsx", "export default function Page() {}\n")
    _write(target / "migration" / "source-receipt.json", '{"schema":"source"}\n')
    _write(target / "migration" / "target-receipt.json", '{"schema":"target"}\n')

    paths = {record.relative_path for record in _iter_adapted_target_files(target)}

    assert paths == {"src/page.tsx"}


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


def test_expected_target_fingerprint_is_path_ordered_across_exact_and_sanitized_files(tmp_path: Path) -> None:
    source = _minimal_source(tmp_path)
    _write(source / "src" / "a-private.ts", 'export const member = "Private Person";\n')
    target = tmp_path / "target"
    replacements = {"Private Person": "Synthetic Member 01"}
    plan = plan_import(source, target, replacements=replacements)

    apply_import(plan, source, target, replacements=replacements)

    assert verify_import(plan, source, target, replacements=replacements).ok is True


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
    assert '"schema": "family-dashboard-import-plan/v2"' in payload
    assert "Private Person" not in payload
    assert "Synthetic Member 01" not in payload
    assert plan.redaction_map_digest in payload


def test_adapted_verify_allows_safe_git_changes_and_excluded_cache_drift(tmp_path: Path) -> None:
    source = _minimal_source(tmp_path)
    target = tmp_path / "target"
    plan = plan_import(source, target, replacements={})
    apply_import(plan, source, target, replacements={})
    _write(target / "src" / "page.tsx", "export default function Adapted() {}\n")
    _write(target / "tests" / "boundary.test.ts", "export {};\n")
    _write(source / "node_modules" / ".cache" / "result.json", "{}\n")

    result = verify_adapted_import(plan, source, target, replacements={})

    assert result.ok
    assert result.verification_mode == "adapted-target"
    assert result.excluded_source_drift


def test_adapted_verify_rejects_selected_source_drift(tmp_path: Path) -> None:
    source = _minimal_source(tmp_path)
    target = tmp_path / "target"
    plan = plan_import(source, target, replacements={})
    apply_import(plan, source, target, replacements={})
    _write(source / "src" / "page.tsx", "changed source\n")

    with pytest.raises(ImportClosedError, match="selected source drift"):
        verify_adapted_import(plan, source, target, replacements={})
