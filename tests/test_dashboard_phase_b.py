import json
from pathlib import Path
from types import SimpleNamespace

import pytest

import family_hub.dashboard_phase_b as phase_b
import family_hub.dashboard_runtime as runtime
from family_hub.dashboard_runtime import PhaseBError, apply_runtime, plan_runtime


def _seed_runtime_source(tmp_path: Path) -> tuple[Path, Path, Path]:
    documents = tmp_path / "Documents" / "family"
    legacy = documents / "family-dashboard-app"
    manifests = legacy / "data-manifest"
    generated = legacy / "app-data"
    manifests.mkdir(parents=True)
    generated.mkdir()
    for name in ("summary", "members", "health", "growth", "daily", "assets"):
        (manifests / f"{name}.yaml").write_text(f"title: {name}\n", encoding="utf-8")
    (generated / "summary.json").write_text('{"value": 1}\n', encoding="utf-8")
    state = tmp_path / "Workspace" / "runtime" / "family-hub" / "dashboard"
    return documents, legacy, state


def test_runtime_plan_is_private_pathless_and_deterministic(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    first = plan_runtime(documents, legacy, state)
    second = plan_runtime(documents, legacy, state)
    assert first == second
    assert first["schema"] == "family-dashboard-runtime-plan/v1"
    assert first["manifest_count"] == 6
    assert first["legacy_generated_count"] == 1
    assert first["state_root_ref"] == "runtime://family-hub/dashboard"
    assert str(tmp_path) not in str(first)


def test_runtime_plan_rejects_existing_target_and_symlink(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    state.mkdir(parents=True)
    with pytest.raises(PhaseBError, match="target must be absent"):
        plan_runtime(documents, legacy, state)


def test_runtime_plan_rejects_insufficient_disk(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    monkeypatch.setattr(runtime.shutil, "disk_usage", lambda _path: SimpleNamespace(free=0))
    with pytest.raises(PhaseBError, match="insufficient disk"):
        plan_runtime(documents, legacy, state)


def test_apply_runtime_builds_in_staging_and_promotes_atomically(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    plan = plan_runtime(documents, legacy, state)

    def build(env: dict[str, str]) -> None:
        generated = Path(env["FAMILY_DASHBOARD_STATE_ROOT"]) / "generated"
        generated.mkdir(parents=True)
        (generated / "summary.json").write_text('{"value": 1}\n', encoding="utf-8")

    result = apply_runtime(
        plan,
        documents_root=documents,
        legacy_app_root=legacy,
        state_root=state,
        expected_fingerprint=plan["fingerprint"],
        build_runner=build,
    )
    assert result["status"] == "verified"
    assert (state / "manifests" / "summary.yaml").stat().st_mode & 0o777 == 0o600
    assert (state / "generated" / "summary.json").stat().st_mode & 0o777 == 0o600
    assert json.loads((state / "generated" / "summary.json").read_text())["value"] == 1
    assert not list(state.parent.glob(".dashboard.staging-*"))


def test_apply_runtime_failure_removes_staging_and_preserves_source(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    plan = plan_runtime(documents, legacy, state)
    before = (legacy / "data-manifest" / "summary.yaml").read_bytes()
    with pytest.raises(PhaseBError, match="build failed"):
        apply_runtime(
            plan,
            documents_root=documents,
            legacy_app_root=legacy,
            state_root=state,
            expected_fingerprint=plan["fingerprint"],
            build_runner=lambda _env: (_ for _ in ()).throw(RuntimeError("boom")),
        )
    assert not state.exists()
    assert (legacy / "data-manifest" / "summary.yaml").read_bytes() == before


def test_apply_runtime_parity_difference_names_product_and_does_not_promote(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    plan = plan_runtime(documents, legacy, state)

    def build(env: dict[str, str]) -> None:
        generated = Path(env["FAMILY_DASHBOARD_STATE_ROOT"]) / "generated"
        generated.mkdir(parents=True)
        (generated / "summary.json").write_text('{"value": 2}\n', encoding="utf-8")

    with pytest.raises(PhaseBError, match="normalized parity differs: summary.json"):
        apply_runtime(
            plan,
            documents_root=documents,
            legacy_app_root=legacy,
            state_root=state,
            expected_fingerprint=plan["fingerprint"],
            build_runner=build,
        )
    assert not state.exists()
    assert not list(state.parent.glob(".dashboard.staging-*"))


def test_apply_runtime_cli_requires_explicit_roots_and_returns_json(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    fingerprint = plan_runtime(documents, legacy, state)["fingerprint"]

    def build(env: dict[str, str]) -> None:
        generated = Path(env["FAMILY_DASHBOARD_STATE_ROOT"]) / "generated"
        generated.mkdir(parents=True)
        (generated / "summary.json").write_text('{"value": 1}\n', encoding="utf-8")

    monkeypatch.setattr(phase_b, "_bun_build_runner", lambda _app_root: build, raising=False)
    result = phase_b.main(
        [
            "apply-runtime",
            "--documents-root",
            str(documents),
            "--legacy-app-root",
            str(legacy),
            "--state-root",
            str(state),
            "--expected-fingerprint",
            fingerprint,
            "--app-root",
            str(tmp_path / "app"),
            "--json",
        ]
    )
    assert result == 0
    assert json.loads(capsys.readouterr().out)["status"] == "verified"


def test_verify_runtime_cli_loads_bound_plan(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    plan = plan_runtime(documents, legacy, state)

    def build(env: dict[str, str]) -> None:
        generated = Path(env["FAMILY_DASHBOARD_STATE_ROOT"]) / "generated"
        generated.mkdir(parents=True)
        (generated / "summary.json").write_text('{"value": 1}\n', encoding="utf-8")

    apply_runtime(
        plan,
        documents_root=documents,
        legacy_app_root=legacy,
        state_root=state,
        expected_fingerprint=plan["fingerprint"],
        build_runner=build,
    )
    result = phase_b.main(
        [
            "verify-runtime",
            "--documents-root",
            str(documents),
            "--state-root",
            str(state),
            "--json",
        ]
    )
    assert result == 0
    assert json.loads(capsys.readouterr().out)["source_fingerprint"] == plan["fingerprint"]
