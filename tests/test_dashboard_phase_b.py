import copy
import hashlib
import json
import os
import shutil
import stat
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
import yaml

import family_hub.dashboard_mutation as mutation
import family_hub.dashboard_phase_b as phase_b
import family_hub.dashboard_runtime as runtime
from family_hub.dashboard_mutation import build_canary_proposal, execute_approved_mutation, stage_payload
from family_hub.dashboard_runtime import PhaseBError, apply_runtime, plan_runtime, verify_runtime


def _seed_builder_input_trees(documents: Path) -> None:
    for name in ("_knowledge", "_archive", "_control"):
        tree = documents / name
        tree.mkdir(parents=True)
        (tree / f"{name.removeprefix('_')}.md").write_text(
            f"# {name}\n",
            encoding="utf-8",
        )


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
    _seed_builder_input_trees(documents)
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


def test_runtime_plan_has_no_paths_or_source_bodies_anywhere(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    source_body = "PRIVATE-BODY-MUST-NOT-LEAK"
    (documents / "_knowledge" / "knowledge.md").write_text(source_body, encoding="utf-8")
    (legacy / "data-manifest" / "summary.yaml").write_text(
        f'title: summary\nsource_body: "{source_body}"\n',
        encoding="utf-8",
    )

    plan = plan_runtime(documents, legacy, state)
    encoded = json.dumps(plan, ensure_ascii=False, sort_keys=True)

    for forbidden in (
        str(documents),
        str(legacy),
        "_knowledge",
        "_archive",
        "_control",
        "data-manifest",
        "app-data",
        source_body,
        "relative_path",
    ):
        assert forbidden not in encoded
    assert all(set(entry) == {"path_digest", "sha256", "bytes", "mode"} for entry in plan["entries"])


def test_plan_fingerprint_covers_the_complete_plan_payload(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    plan = plan_runtime(documents, legacy, state)
    original = plan["fingerprint"]

    tampered = copy.deepcopy(plan)
    tampered["required_free_bytes"] += 1
    with pytest.raises(PhaseBError, match="fingerprint mismatch"):
        runtime.plan_fingerprint(tampered)

    rebound = copy.deepcopy(tampered)
    rebound.pop("fingerprint")
    rebound["fingerprint"] = runtime.canonical_plan_fingerprint(rebound)
    assert runtime.plan_fingerprint(rebound) != original


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


def test_runtime_plan_binds_pathless_builder_input_closure(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)

    first = plan_runtime(documents, legacy, state)
    closure = first["input_closure"]
    encoded = json.dumps(closure, ensure_ascii=False, sort_keys=True)

    assert closure["schema"] == "family-dashboard-input-closure/v1"
    assert closure["file_count"] == 9
    assert closure["aggregate_digest"].startswith("sha256:")
    assert "_knowledge" not in encoded
    assert str(documents) not in encoded

    (documents / "_knowledge" / "knowledge.md").write_text(
        "# changed\n",
        encoding="utf-8",
    )
    second = plan_runtime(documents, legacy, state)
    assert second["input_closure"]["aggregate_digest"] != closure["aggregate_digest"]
    assert second["fingerprint"] != first["fingerprint"]


def test_runtime_plan_rejects_symlink_inside_builder_input(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    link = documents / "_knowledge" / "linked-control.md"
    link.symlink_to(documents / "_control" / "control.md")

    with pytest.raises(PhaseBError, match="builder input closure contains a symlink"):
        plan_runtime(documents, legacy, state)


def test_runtime_plan_excludes_non_builder_control_metadata_links(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    baseline = plan_runtime(documents, legacy, state)
    shared_standard = tmp_path / "shared-standard.md"
    shared_standard.write_text("# shared standard\n", encoding="utf-8")
    metadata = documents / "_control" / "_meta"
    metadata.mkdir()
    (metadata / "standard.md").symlink_to(shared_standard)

    observed = plan_runtime(documents, legacy, state)

    assert observed["input_closure"] == baseline["input_closure"]
    assert observed["fingerprint"] == baseline["fingerprint"]


def test_runtime_plan_excludes_builder_ignored_node_modules_links(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    baseline = plan_runtime(documents, legacy, state)
    package_bin = documents / "_archive" / "snapshot" / "node_modules" / ".bin"
    package_bin.mkdir(parents=True)
    executable = tmp_path / "package-cli.js"
    executable.write_text("export {};\n", encoding="utf-8")
    (package_bin / "package-cli").symlink_to(executable)

    observed = plan_runtime(documents, legacy, state)

    assert observed["input_closure"] == baseline["input_closure"]
    assert observed["fingerprint"] == baseline["fingerprint"]


def test_normalized_product_digest_removes_only_declared_fields(tmp_path: Path) -> None:
    first = tmp_path / "summary.json"
    second = tmp_path / "other" / "summary.json"
    second.parent.mkdir()
    first.write_text(
        '{"meta":{"generatedAt":"first"},"updatedAt":"first","value":1}\n',
        encoding="utf-8",
    )
    second.write_text(
        '{"meta":{"generatedAt":"second"},"updatedAt":"second","value":1}\n',
        encoding="utf-8",
    )
    assert runtime.normalized_product_digest(first) == runtime.normalized_product_digest(second)

    second.write_text(
        '{"meta":{"generatedAt":"second"},"updatedAt":"second","value":2}\n',
        encoding="utf-8",
    )
    assert runtime.normalized_product_digest(first) != runtime.normalized_product_digest(second)


def test_normalized_product_digest_canonicalizes_unpaired_surrogates(tmp_path: Path) -> None:
    first = tmp_path / "calendar.json"
    second = tmp_path / "other" / "calendar.json"
    second.parent.mkdir()
    first.write_text(
        '{"label":"\\udf82","nested":{"marker":"\\ud83c"}}\n',
        encoding="utf-8",
    )
    second.write_text(
        '{"nested":{"marker":"\\ud83c"},"label":"\\udf82"}\n',
        encoding="utf-8",
    )

    assert runtime.normalized_product_digest(first) == runtime.normalized_product_digest(second)


@pytest.mark.parametrize(
    ("name", "body"),
    [
        ("summary.json", "[]\n"),
        ("search-index.json", "{}\n"),
        ("summary.json", "1\n"),
    ],
)
def test_product_digest_rejects_wrong_declared_root_shape(tmp_path: Path, name: str, body: str) -> None:
    product = tmp_path / name
    product.write_text(body, encoding="utf-8")
    with pytest.raises(PhaseBError, match="root schema"):
        runtime.normalized_product_digest(product)


def test_product_digest_rejects_unknown_product_name(tmp_path: Path) -> None:
    product = tmp_path / "surprise.json"
    product.write_text("{}\n", encoding="utf-8")
    with pytest.raises(PhaseBError, match="unknown product"):
        runtime.normalized_product_digest(product)


@pytest.mark.parametrize(
    ("name", "root"),
    [
        *((name, {}) for name in ("summary.json", "members.json", "health.json", "growth.json", "daily.json")),
        *((name, {}) for name in ("assets.json", "milestones.json", "vaccines.json", "calendar.json", "finance.json")),
        *((name, {}) for name in ("build-meta.json", "tags.json", "links.json")),
        *((name, []) for name in ("timeline.json", "tasks.json", "search-index.json", "search-chunks.json")),
        *((name, []) for name in ("search-embeddings.json", "search-chunks-embeddings.json")),
    ],
)
def test_product_digest_accepts_each_declared_known_root_schema(tmp_path: Path, name: str, root: object) -> None:
    product = tmp_path / name
    product.write_text(json.dumps(root), encoding="utf-8")
    assert runtime.normalized_product_digest(product).startswith("sha256:")


def test_product_digest_blocks_unreadable_product(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    product = tmp_path / "summary.json"
    product.write_text("{}\n", encoding="utf-8")
    original_read_text = Path.read_text

    def denied_read_text(path: Path, *args: object, **kwargs: object) -> str:
        if path == product:
            raise PermissionError("denied")
        return original_read_text(path, *args, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr(Path, "read_text", denied_read_text)
    with pytest.raises(PhaseBError, match="unreadable"):
        runtime.normalized_product_digest(product)


@pytest.mark.parametrize("body", ["not-json\n", "[]\n"])
def test_runtime_plan_blocks_malformed_or_incompatible_legacy_baseline(tmp_path: Path, body: str) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    (legacy / "app-data" / "summary.json").write_text(body, encoding="utf-8")
    with pytest.raises(PhaseBError, match="malformed|root schema"):
        plan_runtime(documents, legacy, state)


def test_runtime_plan_blocks_missing_legacy_baseline(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    (legacy / "app-data" / "summary.json").unlink()
    with pytest.raises(PhaseBError, match="product set is empty"):
        plan_runtime(documents, legacy, state)


def test_runtime_plan_blocks_symlinked_legacy_product_directory(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    products = legacy / "app-data"
    outside = tmp_path / "outside-products"
    products.rename(outside)
    products.symlink_to(outside, target_is_directory=True)
    with pytest.raises(PhaseBError, match="product directory"):
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


@pytest.mark.parametrize(
    ("staging_suffix", "attack"),
    [(suffix, attack) for suffix in ("-a", "-b") for attack in ("content", "mode")],
)
def test_apply_runtime_rejects_builder_modified_manifest(
    tmp_path: Path,
    staging_suffix: str,
    attack: str,
) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    plan = plan_runtime(documents, legacy, state)

    def build(env: dict[str, str]) -> None:
        staging = Path(env["FAMILY_DASHBOARD_STATE_ROOT"])
        generated = staging / "generated"
        generated.mkdir(parents=True)
        (generated / "summary.json").write_text('{"value": 1}\n', encoding="utf-8")
        if staging.name.endswith(staging_suffix):
            manifest = staging / "manifests" / "summary.yaml"
            if attack == "content":
                manifest.write_text("title: builder-controlled\n", encoding="utf-8")
            else:
                manifest.chmod(0o640)

    with pytest.raises(PhaseBError, match="staging manifest"):
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


@pytest.mark.parametrize("staging_suffix", ["-a", "-b"])
def test_apply_runtime_rejects_nonregular_staging_node(
    tmp_path: Path,
    staging_suffix: str,
) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    plan = plan_runtime(documents, legacy, state)
    outside = tmp_path / "outside-cache"
    outside.mkdir()

    def build(env: dict[str, str]) -> None:
        staging = Path(env["FAMILY_DASHBOARD_STATE_ROOT"])
        generated = staging / "generated"
        generated.mkdir(parents=True)
        (generated / "summary.json").write_text('{"value": 1}\n', encoding="utf-8")
        if staging.name.endswith(staging_suffix):
            (staging / "cache").rmdir()
            (staging / "cache").symlink_to(outside, target_is_directory=True)

    with pytest.raises(PhaseBError, match="staging layout contains a non-regular node"):
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
    assert outside.exists()


@pytest.mark.parametrize(
    ("staging_suffix", "unexpected_path", "is_directory"),
    [
        ("-a", "builder-output.txt", False),
        ("-a", "builder-output", True),
        ("-b", "builder-output.txt", False),
        ("-b", "builder-output", True),
    ],
)
def test_apply_runtime_rejects_unknown_staging_file_or_directory(
    tmp_path: Path,
    staging_suffix: str,
    unexpected_path: str,
    is_directory: bool,
) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    plan = plan_runtime(documents, legacy, state)

    def build(env: dict[str, str]) -> None:
        staging = Path(env["FAMILY_DASHBOARD_STATE_ROOT"])
        generated = staging / "generated"
        generated.mkdir(parents=True)
        (generated / "summary.json").write_text('{"value": 1}\n', encoding="utf-8")
        if staging.name.endswith(staging_suffix):
            unexpected = staging / unexpected_path
            if is_directory:
                unexpected.mkdir()
            else:
                unexpected.write_text("unexpected\n", encoding="utf-8")

    with pytest.raises(PhaseBError, match="staging layout"):
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


@pytest.mark.parametrize("staging_suffix", ["-a", "-b"])
def test_apply_runtime_rejects_builder_created_premature_receipt(
    tmp_path: Path,
    staging_suffix: str,
) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    plan = plan_runtime(documents, legacy, state)

    def build(env: dict[str, str]) -> None:
        staging = Path(env["FAMILY_DASHBOARD_STATE_ROOT"])
        generated = staging / "generated"
        generated.mkdir(parents=True)
        (generated / "summary.json").write_text('{"value": 1}\n', encoding="utf-8")
        if staging.name.endswith(staging_suffix):
            (staging / "migration" / "receipt.json").write_text("{}\n", encoding="utf-8")

    with pytest.raises(PhaseBError, match="staging migration"):
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


def test_apply_runtime_post_promotion_verify_failure_removes_target(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    plan = plan_runtime(documents, legacy, state)

    def build(env: dict[str, str]) -> None:
        generated = Path(env["FAMILY_DASHBOARD_STATE_ROOT"]) / "generated"
        generated.mkdir(parents=True)
        (generated / "summary.json").write_text('{"value": 1}\n', encoding="utf-8")

    def fail_verification(*_args: object, **_kwargs: object) -> dict[str, object]:
        (state / "migration" / "receipt.json").write_text("{}\n", encoding="utf-8")
        raise PhaseBError("injected post-promotion verification failure")

    monkeypatch.setattr(runtime, "verify_runtime", fail_verification)
    with pytest.raises(PhaseBError, match="injected post-promotion verification failure"):
        apply_runtime(
            plan,
            documents_root=documents,
            legacy_app_root=legacy,
            state_root=state,
            expected_fingerprint=plan["fingerprint"],
            build_runner=build,
        )
    assert not state.exists()


def test_apply_runtime_final_receipt_write_failure_removes_target(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    plan = plan_runtime(documents, legacy, state)

    def build(env: dict[str, str]) -> None:
        generated = Path(env["FAMILY_DASHBOARD_STATE_ROOT"]) / "generated"
        generated.mkdir(parents=True)
        (generated / "summary.json").write_text('{"value": 1}\n', encoding="utf-8")

    atomic_json = runtime._atomic_json

    def fail_receipt_write(path: Path, payload: dict[str, object]) -> None:
        atomic_json(path, payload)
        if path.name == "receipt.json":
            raise OSError("injected final receipt write failure")

    monkeypatch.setattr(runtime, "_atomic_json", fail_receipt_write)
    with pytest.raises(OSError, match="injected final receipt write failure"):
        apply_runtime(
            plan,
            documents_root=documents,
            legacy_app_root=legacy,
            state_root=state,
            expected_fingerprint=plan["fingerprint"],
            build_runner=build,
        )
    assert not state.exists()


def test_apply_runtime_existing_target_collision_is_preserved(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    plan = plan_runtime(documents, legacy, state)
    state.mkdir(parents=True)
    marker = state / "existing-target"
    marker.write_text("owned elsewhere\n", encoding="utf-8")

    with pytest.raises(PhaseBError, match="target must be absent"):
        apply_runtime(
            plan,
            documents_root=documents,
            legacy_app_root=legacy,
            state_root=state,
            expected_fingerprint=plan["fingerprint"],
            build_runner=lambda _env: None,
        )
    assert marker.read_text(encoding="utf-8") == "owned elsewhere\n"


def test_recover_runtime_quarantines_partial_target_and_preserves_matching_tasks(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    (legacy / "app-data" / "tasks.json").write_text(
        '[{"id":"task-1","done":false}]\n',
        encoding="utf-8",
    )
    plan = plan_runtime(documents, legacy, state)
    partial_tasks = state / "generated" / "tasks.json"
    partial_tasks.parent.mkdir(parents=True)
    partial_tasks.write_text('[{"id":"task-1","done":false}]\n', encoding="utf-8")
    (state / "migration").mkdir()
    (state / "migration" / "server-canary.log").write_text("owned log\n", encoding="utf-8")
    original_tasks_digest = runtime._sha(partial_tasks)

    def build(env: dict[str, str]) -> None:
        generated = Path(env["FAMILY_DASHBOARD_STATE_ROOT"]) / "generated"
        generated.mkdir(parents=True)
        (generated / "summary.json").write_text('{"value": 1}\n', encoding="utf-8")
        (generated / "tasks.json").write_text(
            '[{"id":"task-1","done":false}]\n',
            encoding="utf-8",
        )

    receipt = runtime.recover_runtime(
        documents,
        legacy,
        state,
        expected_fingerprint=plan["fingerprint"],
        build_runner=build,
    )

    recovery_roots = list(state.parent.glob(".dashboard.recovery-*"))
    assert receipt["status"] == "recovered"
    assert receipt["preserved_tasks"]["status"] == "equal"
    assert runtime._sha(state / "generated" / "tasks.json") == original_tasks_digest
    assert len(recovery_roots) == 1
    assert runtime._sha(recovery_roots[0] / "generated" / "tasks.json") == original_tasks_digest
    assert verify_runtime(documents, legacy, state, expected_fingerprint=plan["fingerprint"])["status"] == "verified"


def test_recover_runtime_rejects_an_empty_target_without_moving_it(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    plan = plan_runtime(documents, legacy, state)
    state.mkdir(parents=True)

    with pytest.raises(PhaseBError, match="partial runtime target is empty"):
        runtime.recover_runtime(
            documents,
            legacy,
            state,
            expected_fingerprint=plan["fingerprint"],
            build_runner=lambda _env: None,
        )

    assert state.exists()
    assert not list(state.parent.glob(".dashboard.recovery-*"))


def test_recover_runtime_restores_partial_target_when_rebuild_fails(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    plan = plan_runtime(documents, legacy, state)
    marker = state / "migration" / "partial.log"
    marker.parent.mkdir(parents=True)
    marker.write_text("preserve me\n", encoding="utf-8")

    def fail_build(_env: dict[str, str]) -> None:
        raise OSError("injected rebuild failure")

    with pytest.raises(PhaseBError, match="build failed"):
        runtime.recover_runtime(
            documents,
            legacy,
            state,
            expected_fingerprint=plan["fingerprint"],
            build_runner=fail_build,
        )

    assert marker.read_text(encoding="utf-8") == "preserve me\n"
    assert not list(state.parent.glob(".dashboard.recovery-*"))


def test_recover_runtime_refuses_an_existing_bound_target(tmp_path: Path) -> None:
    documents, legacy, state, plan = _apply_seeded_runtime(tmp_path)

    with pytest.raises(PhaseBError, match="refuses a bound runtime target"):
        runtime.recover_runtime(
            documents,
            legacy,
            state,
            expected_fingerprint=plan["fingerprint"],
            build_runner=lambda _env: None,
        )

    assert (state / "migration" / "plan.json").is_file()
    assert not list(state.parent.glob(".dashboard.recovery-*"))


def test_recover_runtime_restores_partial_target_when_tasks_differ(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    (legacy / "app-data" / "tasks.json").write_text(
        '[{"id":"source-task","done":false}]\n',
        encoding="utf-8",
    )
    plan = plan_runtime(documents, legacy, state)
    original_tasks = state / "generated" / "tasks.json"
    original_tasks.parent.mkdir(parents=True)
    original_tasks.write_text('[{"id":"preserved-task","done":false}]\n', encoding="utf-8")

    def build(env: dict[str, str]) -> None:
        generated = Path(env["FAMILY_DASHBOARD_STATE_ROOT"]) / "generated"
        generated.mkdir(parents=True)
        (generated / "summary.json").write_text('{"value": 1}\n', encoding="utf-8")
        (generated / "tasks.json").write_text(
            '[{"id":"source-task","done":false}]\n',
            encoding="utf-8",
        )

    with pytest.raises(PhaseBError, match="recovered tasks differ"):
        runtime.recover_runtime(
            documents,
            legacy,
            state,
            expected_fingerprint=plan["fingerprint"],
            build_runner=build,
        )

    assert json.loads(original_tasks.read_text(encoding="utf-8"))[0]["id"] == "preserved-task"
    assert not list(state.parent.glob(".dashboard.recovery-*"))


def test_apply_runtime_promotes_equal_fresh_builds_and_records_legacy_delta(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    plan = plan_runtime(documents, legacy, state)

    def build(env: dict[str, str]) -> None:
        generated = Path(env["FAMILY_DASHBOARD_STATE_ROOT"]) / "generated"
        generated.mkdir(parents=True)
        (generated / "summary.json").write_text(
            '{"updatedAt":"volatile","value":2}\n',
            encoding="utf-8",
        )

    receipt = apply_runtime(
        plan,
        documents_root=documents,
        legacy_app_root=legacy,
        state_root=state,
        expected_fingerprint=plan["fingerprint"],
        build_runner=build,
    )
    parity = json.loads((state / "migration" / "parity.json").read_text())
    assert receipt["fresh_build_parity"] == "equal"
    assert receipt["legacy_delta_status"] == "observed"
    assert receipt["legacy_delta_count"] == 1
    assert parity["legacy_delta"]["results"] == {"summary.json": "different"}
    assert not list(state.parent.glob(".dashboard.staging-*"))


def _apply_seeded_runtime(tmp_path: Path) -> tuple[Path, Path, Path, dict[str, object]]:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    plan = plan_runtime(documents, legacy, state)

    def build(env: dict[str, str]) -> None:
        generated = Path(env["FAMILY_DASHBOARD_STATE_ROOT"]) / "generated"
        generated.mkdir(parents=True)
        (generated / "summary.json").write_text('{"value": 2}\n', encoding="utf-8")

    apply_runtime(
        plan,
        documents_root=documents,
        legacy_app_root=legacy,
        state_root=state,
        expected_fingerprint=plan["fingerprint"],
        build_runner=build,
    )
    return documents, legacy, state, plan


@pytest.mark.parametrize(
    "mutation",
    [
        lambda evidence: evidence["fresh_build"].update(status="equal", product_count=99),
        lambda evidence: evidence["fresh_build"].update(aggregate_digest="sha256:forged"),
        lambda evidence: evidence["fresh_build"].update(product_digests={"summary.json": "sha256:forged"}),
        lambda evidence: evidence["legacy_delta"].update(different_count=0),
        lambda evidence: evidence["legacy_delta"]["results"].update({"summary.json": "equal"}),
        lambda evidence: evidence["legacy_delta"].update(legacy_aggregate_digest="sha256:forged"),
        lambda evidence: evidence["input_closure"].update(aggregate_digest="sha256:forged"),
        lambda evidence: evidence["input_closure"].update(status="stable", observation_count=999),
    ],
)
def test_verify_runtime_rejects_forged_parity_evidence(tmp_path: Path, mutation: object) -> None:
    documents, legacy, state, plan = _apply_seeded_runtime(tmp_path)
    parity_path = state / "migration" / "parity.json"
    evidence = json.loads(parity_path.read_text(encoding="utf-8"))
    mutation(evidence)  # type: ignore[operator]
    parity_path.write_text(json.dumps(evidence), encoding="utf-8")

    with pytest.raises(PhaseBError, match="parity receipt is invalid"):
        verify_runtime(
            documents,
            legacy,
            state,
            expected_fingerprint=plan["fingerprint"],
        )


def test_verify_runtime_recomputes_promoted_and_legacy_products(tmp_path: Path) -> None:
    documents, legacy, state, plan = _apply_seeded_runtime(tmp_path)
    (state / "generated" / "summary.json").write_text('{"value": 99}\n', encoding="utf-8")
    with pytest.raises(PhaseBError, match="parity receipt is invalid"):
        verify_runtime(documents, legacy, state, expected_fingerprint=plan["fingerprint"])

    (state / "generated" / "summary.json").write_text('{"value": 2}\n', encoding="utf-8")
    (legacy / "app-data" / "summary.json").write_text('{"value": 2}\n', encoding="utf-8")
    with pytest.raises(PhaseBError, match="parity receipt is invalid"):
        verify_runtime(documents, legacy, state, expected_fingerprint=plan["fingerprint"])


def test_verify_runtime_rejects_tampered_bound_plan_even_with_original_expected_fingerprint(tmp_path: Path) -> None:
    documents, legacy, state, plan = _apply_seeded_runtime(tmp_path)
    plan_path = state / "migration" / "plan.json"
    bound = json.loads(plan_path.read_text(encoding="utf-8"))
    bound["manifest_count"] = 999
    plan_path.write_text(json.dumps(bound), encoding="utf-8")
    with pytest.raises(PhaseBError, match="runtime plan fingerprint mismatch"):
        verify_runtime(documents, legacy, state, expected_fingerprint=plan["fingerprint"])


def test_apply_runtime_rejects_nondeterministic_fresh_builds(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    plan = plan_runtime(documents, legacy, state)
    calls = 0

    def build(env: dict[str, str]) -> None:
        nonlocal calls
        calls += 1
        generated = Path(env["FAMILY_DASHBOARD_STATE_ROOT"]) / "generated"
        generated.mkdir(parents=True)
        (generated / "summary.json").write_text(
            json.dumps({"value": calls}) + "\n",
            encoding="utf-8",
        )

    with pytest.raises(PhaseBError, match="fresh build parity differs: summary.json"):
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


def test_apply_runtime_rejects_input_drift_between_builds(tmp_path: Path) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    plan = plan_runtime(documents, legacy, state)
    calls = 0

    def build(env: dict[str, str]) -> None:
        nonlocal calls
        calls += 1
        generated = Path(env["FAMILY_DASHBOARD_STATE_ROOT"]) / "generated"
        generated.mkdir(parents=True)
        (generated / "summary.json").write_text('{"value":1}\n', encoding="utf-8")
        if calls == 1:
            (documents / "_knowledge" / "knowledge.md").write_text(
                "# drifted during migration\n",
                encoding="utf-8",
            )

    with pytest.raises(PhaseBError, match="builder input closure changed"):
        apply_runtime(
            plan,
            documents_root=documents,
            legacy_app_root=legacy,
            state_root=state,
            expected_fingerprint=plan["fingerprint"],
            build_runner=build,
        )
    assert not state.exists()


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


def test_recover_runtime_cli_requires_explicit_roots_and_returns_json(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    documents, legacy, state = _seed_runtime_source(tmp_path)
    fingerprint = plan_runtime(documents, legacy, state)["fingerprint"]
    (state / "migration").mkdir(parents=True)
    (state / "migration" / "partial.log").write_text("partial\n", encoding="utf-8")

    def build(env: dict[str, str]) -> None:
        generated = Path(env["FAMILY_DASHBOARD_STATE_ROOT"]) / "generated"
        generated.mkdir(parents=True)
        (generated / "summary.json").write_text('{"value": 1}\n', encoding="utf-8")

    monkeypatch.setattr(phase_b, "_bun_build_runner", lambda _app_root: build, raising=False)
    result = phase_b.main(
        [
            "recover-runtime",
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
    assert json.loads(capsys.readouterr().out)["status"] == "recovered"


def test_verify_runtime_cli_requires_independent_expected_fingerprint(
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
            "--expected-fingerprint",
            plan["fingerprint"],
            "--json",
        ]
    )
    assert result == 0
    assert json.loads(capsys.readouterr().out)["source_fingerprint"] == plan["fingerprint"]


def test_verify_runtime_cli_rejects_missing_expected_fingerprint() -> None:
    with pytest.raises(SystemExit):
        phase_b.main(
            [
                "verify-runtime",
                "--documents-root",
                "/tmp/documents",
                "--state-root",
                "/tmp/state",
            ]
        )


def test_bun_build_runner_wraps_all_build_steps_in_one_read_only_policy(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    documents = (tmp_path / 'Documents "quoted"').resolve()
    state = (tmp_path / "state").resolve()
    calls: list[tuple[list[str], dict[str, str], object, object]] = []
    monkeypatch.setattr(phase_b.sys, "platform", "darwin")
    monkeypatch.setattr(phase_b.os, "lstat", lambda _path: SimpleNamespace(st_mode=stat.S_IFREG | 0o755))
    monkeypatch.setattr(phase_b.os, "access", lambda _path, _mode: True)

    def fake_run(command: list[str], **kwargs: object) -> SimpleNamespace:
        calls.append(  # type: ignore[arg-type]
            (command, kwargs["env"], kwargs.get("stdout"), kwargs.get("stderr"))
        )
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(phase_b.subprocess, "run", fake_run)
    phase_b._bun_build_runner(tmp_path)(
        {
            "FAMILY_DOCUMENTS_ROOT": str(documents),
            "FAMILY_DASHBOARD_STATE_ROOT": str(state),
        }
    )

    assert [call[0][-1] for call in calls] == [
        "scripts/verify-paths.ts",
        "scripts/build-all.ts",
        "scripts/verify-summary.ts",
        "scripts/verify-domain-data.ts",
    ]
    assert all(call[0][:2] == ["/usr/bin/sandbox-exec", "-p"] for call in calls)
    assert len({call[0][2] for call in calls}) == 1
    assert f'(deny file-write* (subpath "{str(documents).replace(chr(34), chr(92) + chr(34))}"))' in calls[0][0][2]
    assert all(set(call[1]) == {"PATH", "FAMILY_DOCUMENTS_ROOT", "FAMILY_DASHBOARD_STATE_ROOT"} for call in calls)
    assert all(call[2] is phase_b.sys.stderr and call[3] is phase_b.sys.stderr for call in calls)


@pytest.mark.parametrize("platform", ["linux", "win32"])
def test_bun_build_runner_fails_closed_off_darwin(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    platform: str,
) -> None:
    monkeypatch.setattr(phase_b.sys, "platform", platform)
    with pytest.raises(PhaseBError, match="sandbox-exec is required"):
        phase_b._bun_build_runner(tmp_path)(
            {
                "FAMILY_DOCUMENTS_ROOT": str(tmp_path / "Documents"),
                "FAMILY_DASHBOARD_STATE_ROOT": str(tmp_path / "state"),
            }
        )


def test_bun_build_runner_rejects_control_characters_in_documents_root(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(phase_b.sys, "platform", "darwin")
    monkeypatch.setattr(phase_b.os, "lstat", lambda _path: SimpleNamespace(st_mode=stat.S_IFREG | 0o755))
    monkeypatch.setattr(phase_b.os, "access", lambda _path, _mode: True)
    with pytest.raises(PhaseBError, match="control character"):
        phase_b._bun_build_runner(tmp_path)(
            {
                "FAMILY_DOCUMENTS_ROOT": str(tmp_path / "Documents") + "\n(alias)",
                "FAMILY_DASHBOARD_STATE_ROOT": str(tmp_path / "state"),
            }
        )


def test_bun_build_runner_rejects_empty_documents_root(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(phase_b.sys, "platform", "darwin")
    monkeypatch.setattr(phase_b.os, "lstat", lambda _path: SimpleNamespace(st_mode=stat.S_IFREG | 0o755))
    monkeypatch.setattr(phase_b.os, "access", lambda _path, _mode: True)
    with pytest.raises(PhaseBError, match="Documents root is required"):
        phase_b._bun_build_runner(tmp_path)(
            {
                "FAMILY_DOCUMENTS_ROOT": "",
                "FAMILY_DASHBOARD_STATE_ROOT": str(tmp_path / "state"),
            }
        )


def test_bun_build_runner_rejects_nonregular_sandbox_exec(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(phase_b.sys, "platform", "darwin")
    monkeypatch.setattr(phase_b.os, "lstat", lambda _path: SimpleNamespace(st_mode=stat.S_IFDIR | 0o755))
    with pytest.raises(PhaseBError, match="regular executable"):
        phase_b._bun_build_runner(tmp_path)(
            {
                "FAMILY_DOCUMENTS_ROOT": str(tmp_path / "Documents"),
                "FAMILY_DASHBOARD_STATE_ROOT": str(tmp_path / "state"),
            }
        )


def test_bun_build_runner_rejects_absent_sandbox_exec(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(phase_b.sys, "platform", "darwin")
    monkeypatch.setattr(phase_b.os, "lstat", lambda _path: (_ for _ in ()).throw(FileNotFoundError()))
    with pytest.raises(PhaseBError, match="regular executable"):
        phase_b._bun_build_runner(tmp_path)(
            {
                "FAMILY_DOCUMENTS_ROOT": str(tmp_path / "Documents"),
                "FAMILY_DASHBOARD_STATE_ROOT": str(tmp_path / "state"),
            }
        )


@pytest.mark.parametrize("result", [OSError("launch failed"), SimpleNamespace(returncode=1)])
def test_bun_build_runner_rejects_failed_launch_or_invalid_policy(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    result: object,
) -> None:
    monkeypatch.setattr(phase_b.sys, "platform", "darwin")
    monkeypatch.setattr(phase_b.os, "lstat", lambda _path: SimpleNamespace(st_mode=stat.S_IFREG | 0o755))
    monkeypatch.setattr(phase_b.os, "access", lambda _path, _mode: True)

    def failed_run(*_args: object, **_kwargs: object) -> object:
        if isinstance(result, BaseException):
            raise result
        return result

    monkeypatch.setattr(phase_b.subprocess, "run", failed_run)
    with pytest.raises(PhaseBError, match="sandboxed build (launch|step) failed"):
        phase_b._bun_build_runner(tmp_path)(
            {
                "FAMILY_DOCUMENTS_ROOT": str(tmp_path / "Documents"),
                "FAMILY_DASHBOARD_STATE_ROOT": str(tmp_path / "state"),
            }
        )


@pytest.mark.skipif(sys.platform != "darwin", reason="requires macOS sandbox-exec")
def test_real_macos_sandboxed_build_child_cannot_write_documents_root(tmp_path: Path) -> None:
    documents = tmp_path / 'Documents "quoted"'
    state = tmp_path / "state"
    fake_bin = tmp_path / "bin"
    documents.mkdir()
    state.mkdir()
    fake_bin.mkdir()
    bun = fake_bin / "bun"
    bun.write_text('#!/bin/sh\nprintf blocked > "$FAMILY_DOCUMENTS_ROOT/forbidden"\n', encoding="utf-8")
    bun.chmod(0o755)
    original_path = os.environ.get("PATH", "")
    os.environ["PATH"] = f"{fake_bin}:{original_path}"
    try:
        with pytest.raises(PhaseBError, match="sandboxed build step failed"):
            phase_b._bun_build_runner(tmp_path)(
                {
                    "FAMILY_DOCUMENTS_ROOT": str(documents),
                    "FAMILY_DASHBOARD_STATE_ROOT": str(state),
                }
            )
    finally:
        os.environ["PATH"] = original_path
    assert not (documents / "forbidden").exists()


@pytest.mark.skipif(
    sys.platform != "darwin" or shutil.which("bun") is None,
    reason="requires macOS sandbox-exec and Bun",
)
def test_real_macos_sandboxed_bun_build_runs_existing_verifiers(tmp_path: Path) -> None:
    documents = tmp_path / "synthetic-documents"
    state = tmp_path / "synthetic-state"
    manifests = state / "manifests"
    for tree in (
        "_knowledge/01.成员档案",
        "_knowledge/02.医疗健康",
        "_knowledge/03.育儿成长",
        "_knowledge/04.家庭日常",
        "_knowledge/05.资产设备",
        "_archive",
        "_control",
    ):
        (documents / tree).mkdir(parents=True, exist_ok=True)
    for relative_path in (
        "_knowledge/03.育儿成长/规划文档/爱蓓乐托育计划.md",
        "_knowledge/04.家庭日常/01.健康管理/宠物/2026-05-31猫咪行为调整方案.md",
        "_knowledge/00.规则与模板/家庭账目规则.md",
        "_knowledge/04.家庭日常/04.家庭财务/README.md",
        "_knowledge/04.家庭日常/04.家庭财务/物业费_2026-2027.md",
        "_knowledge/04.家庭日常/05.理财/README.md",
    ):
        source = documents / relative_path
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_text("# Synthetic fixture\n", encoding="utf-8")
    manifests.mkdir(parents=True)
    for name in ("summary", "members", "health", "growth", "daily", "assets"):
        (manifests / f"{name}.yaml").write_text("{}\n", encoding="utf-8")
    (documents / "_control" / "STATUS.md").write_text("## 当前状态：BUSY\n", encoding="utf-8")
    (documents / "_control" / "STATE.md").write_text(
        "---\nlast-reviewed: 2026-08-01\n---\n| 当前阶段 | **本地物理整合完成** |\n",
        encoding="utf-8",
    )
    (documents / "_control" / "signals.md").write_text(
        "---\nsignals:\n  - type: INFO\n    message: synthetic signal\n---\n",
        encoding="utf-8",
    )
    (documents / "_control" / "TIMELINE.md").write_text(
        "## 2026 年\n| 日期 | 事件 | 说明 | 类型 | 来源 |\n"
        "|---|---|---|---|---|\n"
        "| 2026-09-01 | Synthetic update | fixture | test | synthetic |\n",
        encoding="utf-8",
    )

    app_root = Path(__file__).resolve().parents[1] / "apps" / "dashboard"
    phase_b._bun_build_runner(app_root)(
        {
            "FAMILY_DOCUMENTS_ROOT": str(documents),
            "FAMILY_DASHBOARD_STATE_ROOT": str(state),
        }
    )

    assert (state / "generated" / "summary.json").is_file()
    assert all((state / "generated" / f"{name}.json").is_file() for name in runtime.MANIFEST_NAMES[1:])


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
