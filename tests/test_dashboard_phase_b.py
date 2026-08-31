import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
import yaml

import family_hub.dashboard_mutation as mutation
import family_hub.dashboard_phase_b as phase_b
import family_hub.dashboard_runtime as runtime
from family_hub.dashboard_mutation import build_canary_proposal, execute_approved_mutation, stage_payload
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


def _approved_proposal(
    proposal_id: str,
    target_relative: str,
    staged: dict[str, object],
    *,
    source: bytes = b"",
    source_exists: bool = False,
    source_mode: str = "0o600",
    canary_rollback: bool = False,
) -> dict[str, object]:
    proposal: dict[str, object] = {
        "id": proposal_id,
        "type": "family_dashboard_document_write",
        "debt_id": "family-dashboard-content",
        "source": "family-dashboard",
        "status": "approved",
        "approved_by": "operator://cockpit-api/abc",
        "approved_at": "2026-08-30T23:00:00Z",
        "operation": "replace_text",
        "operation_level": "L3",
        "approval_required": True,
        "auto_apply": "disabled",
        "target": f"documents://family/{target_relative}",
        "target_relative": target_relative,
        "expected_source_exists": source_exists,
        "expected_source_sha256": "sha256:" + hashlib.sha256(source).hexdigest(),
        "expected_source_mode": source_mode,
        "expected_source_bytes": len(source),
        **staged,
    }
    if canary_rollback:
        proposal["canary_rollback"] = True
    return proposal


def _bind_approval(tmp_path: Path, proposal: dict[str, object]) -> Path:
    omo = tmp_path / ".omo"
    approval = omo / "state" / "proposals" / f"{proposal['id']}.processing"
    approval.parent.mkdir(parents=True, exist_ok=True)
    approval.write_text(yaml.safe_dump(proposal), encoding="utf-8")
    return omo


def _set_mutation_roots(
    monkeypatch: pytest.MonkeyPatch,
    *,
    documents: Path,
    state: Path,
    omo: Path,
) -> None:
    monkeypatch.setenv("FAMILY_DOCUMENTS_ROOT", str(documents))
    monkeypatch.setenv("FAMILY_DASHBOARD_STATE_ROOT", str(state))
    monkeypatch.setenv("OMO_DIR", str(omo))


def test_stage_payload_is_private_and_returns_digest_only(tmp_path: Path) -> None:
    state = tmp_path / "state"
    state.mkdir()
    result = stage_payload(state, "proposal-1", b"new body\n")
    payload = state / result["payload_ref"]
    assert payload.read_bytes() == b"new body\n"
    assert payload.stat().st_mode & 0o777 == 0o600
    assert "new body" not in json.dumps(result)


def test_stage_payload_rejects_symlinked_state_parent(tmp_path: Path) -> None:
    state = tmp_path / "state"
    outside = tmp_path / "outside"
    state.mkdir()
    outside.mkdir()
    (state / "proposals").symlink_to(outside, target_is_directory=True)
    with pytest.raises(PhaseBError, match="state path crosses a symlink"):
        stage_payload(state, "proposal-state-symlink", b"new\n")
    assert not (outside / "proposal-state-symlink").exists()


def test_canary_planning_rejects_state_nested_in_documents(tmp_path: Path) -> None:
    documents = tmp_path / "Documents"
    state = documents / "runtime"
    state.mkdir(parents=True)
    with pytest.raises(PhaseBError, match="state root must be outside Documents"):
        build_canary_proposal(documents, state, "proposal-overlap-canary")
    assert not (state / "proposals").exists()


def test_execute_rejects_state_nested_in_documents_before_target_write(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    documents = tmp_path / "Documents"
    state = documents / "runtime"
    state.mkdir(parents=True)
    staged = stage_payload(state, "proposal-overlap-execute", b"new\n")
    proposal = _approved_proposal("proposal-overlap-execute", "_knowledge/new.md", staged)
    omo = _bind_approval(tmp_path, proposal)
    _set_mutation_roots(monkeypatch, documents=documents, state=state, omo=omo)
    with pytest.raises(PhaseBError, match="state root must be outside Documents"):
        execute_approved_mutation({"proposal": proposal})
    assert not (documents / "_knowledge" / "new.md").exists()


def test_execute_approved_mutation_applies_exact_cas_and_writes_receipts(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    documents = tmp_path / "Documents"
    state = tmp_path / "state"
    target = documents / "_knowledge" / "note.md"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"old\n")
    state.mkdir()
    staged = stage_payload(state, "proposal-1", b"new\n")
    proposal = _approved_proposal(
        "proposal-1",
        "_knowledge/note.md",
        staged,
        source=b"old\n",
        source_exists=True,
        source_mode=oct(target.stat().st_mode & 0o7777),
    )
    omo = _bind_approval(tmp_path, proposal)
    _set_mutation_roots(monkeypatch, documents=documents, state=state, omo=omo)
    result = execute_approved_mutation({"proposal": proposal})
    assert result["status"] == "verified"
    assert target.read_bytes() == b"new\n"
    assert (state / result["verify_receipt_ref"]).is_file()


def test_original_backup_is_created_exclusively_with_private_mode(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    documents = tmp_path / "Documents"
    state = tmp_path / "state"
    target = documents / "_knowledge" / "note.md"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"old\n")
    state.mkdir()
    staged = stage_payload(state, "proposal-private-original", b"new\n")
    proposal = _approved_proposal(
        "proposal-private-original",
        "_knowledge/note.md",
        staged,
        source=b"old\n",
        source_exists=True,
        source_mode=oct(target.stat().st_mode & 0o7777),
    )
    omo = _bind_approval(tmp_path, proposal)
    _set_mutation_roots(monkeypatch, documents=documents, state=state, omo=omo)
    real_open = mutation.os.open
    original_opens: list[tuple[int, int]] = []

    def tracked_open(path: str | Path, flags: int, mode: int = 0o777) -> int:
        if Path(path).name == "original":
            original_opens.append((flags, mode))
        return real_open(path, flags, mode)

    monkeypatch.setattr(mutation.os, "open", tracked_open)
    execute_approved_mutation({"proposal": proposal})
    assert len(original_opens) == 1
    flags, mode = original_opens[0]
    assert flags & mutation.os.O_EXCL
    assert mode == 0o600


def test_execute_cas_mismatch_refuses_before_write(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    documents = tmp_path / "Documents"
    state = tmp_path / "state"
    target = documents / "_knowledge" / "note.md"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"old\n")
    state.mkdir()
    staged = stage_payload(state, "proposal-2", b"new\n")
    proposal = _approved_proposal(
        "proposal-2",
        "_knowledge/note.md",
        staged,
        source=b"wrong\n",
        source_exists=True,
        source_mode=oct(target.stat().st_mode & 0o7777),
    )
    omo = _bind_approval(tmp_path, proposal)
    _set_mutation_roots(monkeypatch, documents=documents, state=state, omo=omo)
    before = target.read_bytes()
    with pytest.raises(PhaseBError, match="source CAS mismatch"):
        execute_approved_mutation({"proposal": proposal})
    assert target.read_bytes() == before
    assert not (state / "mutations" / "proposal-2").exists()


def test_execute_refuses_when_target_cas_guard_is_held(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    documents = tmp_path / "Documents"
    state = tmp_path / "state"
    target = documents / "_knowledge" / "note.md"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"old\n")
    state.mkdir()
    staged = stage_payload(state, "proposal-locked", b"new\n")
    proposal = _approved_proposal(
        "proposal-locked",
        "_knowledge/note.md",
        staged,
        source=b"old\n",
        source_exists=True,
        source_mode=oct(target.stat().st_mode & 0o7777),
    )
    omo = _bind_approval(tmp_path, proposal)
    lock_root = state / "locks"
    lock_root.mkdir()
    lock_name = hashlib.sha256(b"_knowledge/note.md").hexdigest() + ".lock"
    lock = lock_root / lock_name
    lock.touch(mode=0o600)
    _set_mutation_roots(monkeypatch, documents=documents, state=state, omo=omo)
    with pytest.raises(PhaseBError, match="target mutation busy"):
        execute_approved_mutation({"proposal": proposal})
    assert target.read_bytes() == b"old\n"
    assert not (state / "mutations" / "proposal-locked").exists()


def test_execute_rejects_symlinked_mutation_parent_before_write(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    documents = tmp_path / "Documents"
    state = tmp_path / "state"
    outside = tmp_path / "outside"
    documents.mkdir()
    state.mkdir()
    outside.mkdir()
    staged = stage_payload(state, "proposal-mutation-symlink", b"new\n")
    (state / "mutations").symlink_to(outside, target_is_directory=True)
    proposal = _approved_proposal("proposal-mutation-symlink", "_knowledge/new.md", staged)
    omo = _bind_approval(tmp_path, proposal)
    _set_mutation_roots(monkeypatch, documents=documents, state=state, omo=omo)
    with pytest.raises(PhaseBError, match="state path crosses a symlink"):
        execute_approved_mutation({"proposal": proposal})
    assert not (documents / "_knowledge" / "new.md").exists()
    assert not (outside / "proposal-mutation-symlink").exists()


@pytest.mark.parametrize(
    "relative",
    ("../escape.md", "/absolute.md", "_knowledge/.hidden.md", "_knowledge/file.exe"),
)
def test_unsafe_documents_targets_are_rejected(tmp_path: Path, relative: str) -> None:
    documents = tmp_path / "Documents"
    documents.mkdir()
    with pytest.raises(PhaseBError, match="unsafe Documents target"):
        mutation._safe_target(documents, relative)


def test_payload_collision_and_drift_are_rejected(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    documents = tmp_path / "Documents"
    state = tmp_path / "state"
    documents.mkdir()
    state.mkdir()
    staged = stage_payload(state, "proposal-drift", b"new\n")
    assert stage_payload(state, "proposal-drift", b"new\n") == staged
    with pytest.raises(PhaseBError, match="proposal payload collision"):
        stage_payload(state, "proposal-drift", b"other\n")
    proposal = _approved_proposal("proposal-drift", "_knowledge/new.md", staged)
    omo = _bind_approval(tmp_path, proposal)
    payload = state / str(staged["payload_ref"])
    payload.write_bytes(b"changed\n")
    payload.chmod(0o600)
    _set_mutation_roots(monkeypatch, documents=documents, state=state, omo=omo)
    with pytest.raises(PhaseBError, match="payload drift"):
        execute_approved_mutation({"proposal": proposal})


def test_payload_ref_must_bind_to_current_proposal(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    documents = tmp_path / "Documents"
    state = tmp_path / "state"
    documents.mkdir()
    state.mkdir()
    staged = stage_payload(state, "different-proposal", b"new\n")
    proposal = _approved_proposal("proposal-bound", "_knowledge/new.md", staged)
    omo = _bind_approval(tmp_path, proposal)
    _set_mutation_roots(monkeypatch, documents=documents, state=state, omo=omo)
    with pytest.raises(PhaseBError, match="payload ref invalid"):
        execute_approved_mutation({"proposal": proposal})
    assert not (documents / "_knowledge" / "new.md").exists()


def test_payload_ref_rejects_symlink(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    documents = tmp_path / "Documents"
    state = tmp_path / "state"
    documents.mkdir()
    state.mkdir()
    real = stage_payload(state, "real-proposal", b"new\n")
    linked = state / "proposals" / "proposal-symlink" / "payload"
    linked.parent.mkdir()
    linked.symlink_to(state / str(real["payload_ref"]))
    staged = {
        "payload_ref": "proposals/proposal-symlink/payload",
        "payload_sha256": real["payload_sha256"],
        "payload_bytes": real["payload_bytes"],
    }
    proposal = _approved_proposal("proposal-symlink", "_knowledge/new.md", staged)
    omo = _bind_approval(tmp_path, proposal)
    _set_mutation_roots(monkeypatch, documents=documents, state=state, omo=omo)
    with pytest.raises(PhaseBError, match="payload ref invalid"):
        execute_approved_mutation({"proposal": proposal})
    assert not (documents / "_knowledge" / "new.md").exists()


def test_missing_omo_approval_refuses_before_write(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    documents = tmp_path / "Documents"
    state = tmp_path / "state"
    omo = tmp_path / ".omo"
    documents.mkdir()
    state.mkdir()
    omo.mkdir()
    staged = stage_payload(state, "proposal-no-approval", b"new\n")
    proposal = _approved_proposal("proposal-no-approval", "_knowledge/new.md", staged)
    _set_mutation_roots(monkeypatch, documents=documents, state=state, omo=omo)
    with pytest.raises(PhaseBError, match="OMO approval record unavailable"):
        execute_approved_mutation({"proposal": proposal})
    assert not (documents / "_knowledge" / "new.md").exists()


def test_unsupported_operation_refuses_before_write(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    documents = tmp_path / "Documents"
    state = tmp_path / "state"
    documents.mkdir()
    state.mkdir()
    staged = stage_payload(state, "proposal-operation", b"new\n")
    proposal = _approved_proposal("proposal-operation", "_knowledge/new.md", staged)
    proposal["operation"] = "task_complete"
    omo = _bind_approval(tmp_path, proposal)
    _set_mutation_roots(monkeypatch, documents=documents, state=state, omo=omo)
    with pytest.raises(PhaseBError, match="proposal operation invalid"):
        execute_approved_mutation({"proposal": proposal})
    assert not (documents / "_knowledge" / "new.md").exists()


def test_displayed_target_must_match_executed_target(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    documents = tmp_path / "Documents"
    state = tmp_path / "state"
    documents.mkdir()
    state.mkdir()
    staged = stage_payload(state, "proposal-target-binding", b"new\n")
    proposal = _approved_proposal("proposal-target-binding", "_knowledge/executed.md", staged)
    proposal["target"] = "documents://family/_knowledge/displayed.md"
    omo = _bind_approval(tmp_path, proposal)
    _set_mutation_roots(monkeypatch, documents=documents, state=state, omo=omo)
    with pytest.raises(PhaseBError, match="proposal target binding mismatch"):
        execute_approved_mutation({"proposal": proposal})
    assert not (documents / "_knowledge" / "executed.md").exists()


@pytest.mark.parametrize("source_exists", (True, False))
def test_apply_receipt_failure_restores_original_state(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    source_exists: bool,
) -> None:
    documents = tmp_path / "Documents"
    state = tmp_path / "state"
    target = documents / "_knowledge" / "note.md"
    documents.mkdir()
    if source_exists:
        target.parent.mkdir(parents=True)
        target.write_bytes(b"old\n")
    state.mkdir()
    proposal_id = "proposal-rollback-existing" if source_exists else "proposal-rollback-new"
    staged = stage_payload(state, proposal_id, b"new\n")
    proposal = _approved_proposal(
        proposal_id,
        "_knowledge/note.md",
        staged,
        source=b"old\n" if source_exists else b"",
        source_exists=source_exists,
        source_mode=oct(target.stat().st_mode & 0o7777) if source_exists else "0o600",
    )
    omo = _bind_approval(tmp_path, proposal)
    _set_mutation_roots(monkeypatch, documents=documents, state=state, omo=omo)
    real_atomic_json = mutation._atomic_json

    def fail_apply_receipt(path: Path, payload: dict[str, object]) -> None:
        if path.name == "apply.json":
            raise OSError("receipt unavailable")
        real_atomic_json(path, payload)

    monkeypatch.setattr(mutation, "_atomic_json", fail_apply_receipt)
    with pytest.raises(PhaseBError, match="failed and rolled back"):
        execute_approved_mutation({"proposal": proposal})
    assert target.is_file() is source_exists
    if source_exists:
        assert target.read_bytes() == b"old\n"
    else:
        assert not target.parent.exists()
    rollback = json.loads((state / "mutations" / proposal_id / "rollback.json").read_text())
    assert rollback["status"] == "rolled_back"


def test_exact_canary_is_applied_verified_and_immediately_rolled_back(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    documents = tmp_path / "Documents"
    state = tmp_path / "state"
    documents.mkdir()
    state.mkdir()
    staged = stage_payload(state, "proposal-canary", b"family-dashboard Phase B write canary\n")
    proposal = _approved_proposal(
        "proposal-canary",
        "_meta/family-dashboard-write-canary.md",
        staged,
        canary_rollback=True,
    )
    proposal["source"] = "family-dashboard-phase-b-operator"
    omo = _bind_approval(tmp_path, proposal)
    _set_mutation_roots(monkeypatch, documents=documents, state=state, omo=omo)
    result = execute_approved_mutation({"proposal": proposal})
    assert result["status"] == "verified"
    assert result["canary_rolled_back"] is True
    assert not (documents / "_meta" / "family-dashboard-write-canary.md").exists()
    assert not (documents / "_meta").exists()
    mutation_root = state / "mutations" / "proposal-canary"
    assert {path.name for path in mutation_root.glob("*.json")} == {
        "prepared.json",
        "apply.json",
        "verify.json",
        "rollback.json",
    }


def test_canary_rollback_rejects_non_operator_envelope(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    documents = tmp_path / "Documents"
    state = tmp_path / "state"
    documents.mkdir()
    state.mkdir()
    staged = stage_payload(state, "proposal-forged-canary", b"ordinary proposal\n")
    proposal = _approved_proposal(
        "proposal-forged-canary",
        "_meta/family-dashboard-write-canary.md",
        staged,
        canary_rollback=True,
    )
    omo = _bind_approval(tmp_path, proposal)
    _set_mutation_roots(monkeypatch, documents=documents, state=state, omo=omo)
    with pytest.raises(PhaseBError, match="canary operator envelope invalid"):
        execute_approved_mutation({"proposal": proposal})
    assert not (documents / "_meta" / "family-dashboard-write-canary.md").exists()


def test_rollback_write_failure_reports_unknown_final_state(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    documents = tmp_path / "Documents"
    state = tmp_path / "state"
    target = documents / "_knowledge" / "note.md"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"old\n")
    state.mkdir()
    staged = stage_payload(state, "proposal-unknown", b"new\n")
    proposal = _approved_proposal(
        "proposal-unknown",
        "_knowledge/note.md",
        staged,
        source=b"old\n",
        source_exists=True,
        source_mode=oct(target.stat().st_mode & 0o7777),
    )
    omo = _bind_approval(tmp_path, proposal)
    _set_mutation_roots(monkeypatch, documents=documents, state=state, omo=omo)
    real_bytes = mutation._atomic_bytes
    real_json = mutation._atomic_json
    calls = 0

    def fail_second_write(path: Path, content: bytes, mode: int) -> None:
        nonlocal calls
        calls += 1
        if calls == 2:
            raise OSError("rollback unavailable")
        real_bytes(path, content, mode)

    def fail_apply_json(path: Path, payload: dict[str, object]) -> None:
        if path.name == "apply.json":
            raise OSError("receipt unavailable")
        real_json(path, payload)

    monkeypatch.setattr(mutation, "_atomic_bytes", fail_second_write)
    monkeypatch.setattr(mutation, "_atomic_json", fail_apply_json)
    with pytest.raises(PhaseBError, match="mutation final state unknown"):
        execute_approved_mutation({"proposal": proposal})


def test_plan_canary_cli_writes_private_operator_envelope(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    documents = tmp_path / "Documents"
    state = tmp_path / "state"
    output = state / "operator" / "canary.json"
    documents.mkdir()
    state.mkdir()
    result = phase_b.main(
        [
            "plan-canary",
            "--documents-root",
            str(documents),
            "--state-root",
            str(state),
            "--proposal-id",
            "proposal-cli-canary",
            "--output",
            str(output),
            "--json",
        ]
    )
    assert result == 0
    proposal = json.loads(output.read_text(encoding="utf-8"))
    assert proposal["id"] == "proposal-cli-canary"
    assert str(proposal["proposal_digest"]).startswith("sha256:")
    assert proposal["canary_rollback"] is True
    assert output.stat().st_mode & 0o777 == 0o600
    assert json.loads(capsys.readouterr().out)["status"] == "planned"
