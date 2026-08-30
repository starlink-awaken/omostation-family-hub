from __future__ import annotations

import hashlib
import json
import stat
from pathlib import Path

from tools.dashboard_import import main


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _source(tmp_path: Path) -> Path:
    source = tmp_path / "Documents" / "family-dashboard-app"
    _write(source / "package.json", '{"private":true}\n')
    _write(source / "src" / "member.ts", 'export const member = "Private Person";\n')
    _write(source / "data-manifest" / "members.yaml", "members:\n  - name: Private Person\n")
    return source


def test_cli_derives_private_map_without_printing_values(tmp_path: Path, capsys) -> None:
    source = _source(tmp_path)
    redaction_map = tmp_path / "private" / "redaction-map.json"

    assert (
        main(
            [
                "derive-redaction-map",
                "--source",
                str(source),
                "--output",
                str(redaction_map),
                "--json",
            ]
        )
        == 0
    )

    output = capsys.readouterr().out
    assert "Private Person" not in output
    assert json.loads(output)["replacement_count"] == 2
    assert stat.S_IMODE(redaction_map.stat().st_mode) == 0o600
    assert "Private Person" in redaction_map.read_text(encoding="utf-8")


def test_cli_plan_apply_and_verify_round_trip(tmp_path: Path, capsys) -> None:
    source = _source(tmp_path)
    target = tmp_path / "target"
    redaction_map = tmp_path / "private" / "redaction-map.json"
    source_receipt = tmp_path / "evidence" / "source.json"
    target_receipt = tmp_path / "evidence" / "target.json"
    assert main(["derive-redaction-map", "--source", str(source), "--output", str(redaction_map), "--json"]) == 0
    capsys.readouterr()

    assert (
        main(
            [
                "plan",
                "--source",
                str(source),
                "--target",
                str(target),
                "--redaction-map",
                str(redaction_map),
                "--source-receipt",
                str(source_receipt),
                "--json",
            ]
        )
        == 0
    )
    plan_output = json.loads(capsys.readouterr().out)
    assert plan_output["status"] == "planned"
    assert plan_output["selected_count"] == 2

    assert (
        main(
            [
                "apply",
                "--source",
                str(source),
                "--target",
                str(target),
                "--redaction-map",
                str(redaction_map),
                "--source-receipt",
                str(source_receipt),
                "--target-receipt",
                str(target_receipt),
                "--json",
            ]
        )
        == 0
    )
    apply_output = json.loads(capsys.readouterr().out)
    assert apply_output["status"] == "completed"
    assert target_receipt.is_file()
    assert "Private Person" not in (target / "src" / "member.ts").read_text(encoding="utf-8")
    source_payload = json.loads(source_receipt.read_text(encoding="utf-8"))
    target_payload = json.loads(target_receipt.read_text(encoding="utf-8"))
    assert source_payload["schema"] == "family-dashboard-import-plan/v2"
    assert target_payload["schema"] == "family-dashboard-import-target/v2"
    assert source_payload["source_root_identity"]["ref"] == "documents://family-dashboard-app"
    assert source_payload["target_root_identity"]["ref"] == "repo://family-hub/apps/dashboard"
    assert target_payload["source_receipt_digest"] == hashlib.sha256(source_receipt.read_bytes()).hexdigest()
    assert target_payload["source_root_identity"] == source_payload["source_root_identity"]
    assert target_payload["target_root_identity"] == source_payload["target_root_identity"]
    assert target_payload["verification_mode"] == "exact-import"
    assert target_payload["excluded_source_drift"] is False
    assert target_payload["observed_target_fingerprint"] == source_payload["expected_target_fingerprint"]
    assert str(tmp_path) not in json.dumps(target_payload, sort_keys=True)

    assert (
        main(
            [
                "verify",
                "--source",
                str(source),
                "--target",
                str(target),
                "--redaction-map",
                str(redaction_map),
                "--source-receipt",
                str(source_receipt),
                "--target-receipt",
                str(target_receipt),
                "--json",
            ]
        )
        == 0
    )
    verify_output = json.loads(capsys.readouterr().out)
    assert verify_output == {
        "full_source_fingerprint": verify_output["full_source_fingerprint"],
        "selected_count": 2,
        "selected_fingerprint": verify_output["selected_fingerprint"],
        "status": "verified",
    }

    _write(target / "tests" / "adapted.test.ts", "export {};\n")
    assert (
        main(
            [
                "verify",
                "--source",
                str(source),
                "--target",
                str(target),
                "--redaction-map",
                str(redaction_map),
                "--source-receipt",
                str(source_receipt),
                "--target-receipt",
                str(target_receipt),
                "--allow-adapted-target",
                "--json",
            ]
        )
        == 0
    )
    adapted_output = json.loads(capsys.readouterr().out)
    assert adapted_output["verification_mode"] == "adapted-target"
