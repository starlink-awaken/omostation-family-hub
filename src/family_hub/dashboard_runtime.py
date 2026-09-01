from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
from collections.abc import Callable
from pathlib import Path
from typing import Any, Final

import yaml

PLAN_SCHEMA: Final = "family-dashboard-runtime-plan/v1"
MANIFEST_NAMES: Final = ("summary", "members", "health", "growth", "daily", "assets")
INPUT_CLOSURE_SCHEMA: Final = "family-dashboard-input-closure/v1"
INPUT_TREE_NAMES: Final = ("_knowledge", "_archive", "_control")
VOLATILE_FIELDS_BY_PRODUCT: Final = {
    "build-meta.json": frozenset({"builtAt"}),
    "summary.json": frozenset({"updatedAt", "generatedAt"}),
    "members.json": frozenset({"updatedAt", "generatedAt"}),
    "health.json": frozenset({"updatedAt", "generatedAt"}),
    "growth.json": frozenset({"updatedAt", "generatedAt"}),
    "daily.json": frozenset({"updatedAt", "generatedAt"}),
    "assets.json": frozenset({"updatedAt", "generatedAt"}),
}
BuildRunner = Callable[[dict[str, str]], None]


class PhaseBError(ValueError):
    """A Phase B runtime or mutation transaction cannot proceed safely."""


def _regular_root(path: Path, label: str, *, must_exist: bool = True) -> Path:
    raw = path.expanduser()
    if raw.is_symlink():
        raise PhaseBError(f"{label} must not be a symlink")
    if must_exist and not raw.is_dir():
        raise PhaseBError(f"{label} must be a regular directory")
    return raw.resolve()


def _sha(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def _entry(path: Path, base: Path) -> dict[str, Any]:
    stat = path.stat(follow_symlinks=False)
    if not path.is_file() or path.is_symlink():
        raise PhaseBError("inventory contains a non-regular node")
    return {
        "relative_path": path.relative_to(base).as_posix(),
        "sha256": _sha(path),
        "bytes": stat.st_size,
        "mode": oct(stat.st_mode & 0o7777),
    }


def _fingerprint(entries: list[dict[str, Any]]) -> str:
    raw = json.dumps(entries, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(raw.encode()).hexdigest()


def _pathless_entry(path: Path, logical_path: str) -> dict[str, Any]:
    metadata = path.stat(follow_symlinks=False)
    if path.is_symlink() or not path.is_file():
        raise PhaseBError("builder input closure contains a non-regular node")
    return {
        "path_digest": "sha256:" + hashlib.sha256(logical_path.encode()).hexdigest(),
        "sha256": _sha(path),
        "bytes": metadata.st_size,
        "mode": oct(metadata.st_mode & 0o7777),
    }


def builder_input_closure(documents_root: Path, legacy_app_root: Path) -> dict[str, Any]:
    documents = _regular_root(documents_root, "Documents root")
    legacy = _regular_root(legacy_app_root, "legacy app root")
    candidates: list[tuple[Path, str]] = [
        (
            legacy / "data-manifest" / f"{name}.yaml",
            f"legacy-manifest/{name}.yaml",
        )
        for name in MANIFEST_NAMES
    ]
    for tree_name in INPUT_TREE_NAMES:
        tree = documents / tree_name
        if tree.is_symlink() or not tree.is_dir():
            raise PhaseBError(f"builder input root is invalid: {tree_name}")
        for node in sorted(tree.rglob("*"), key=lambda item: item.relative_to(documents).as_posix()):
            if node.is_symlink():
                raise PhaseBError("builder input closure contains a symlink")
            if node.is_file():
                candidates.append((node, f"documents/{node.relative_to(documents).as_posix()}"))
            elif not node.is_dir():
                raise PhaseBError("builder input closure contains a non-regular node")
    entries = sorted(
        (_pathless_entry(path, logical) for path, logical in candidates),
        key=lambda item: item["path_digest"],
    )
    return {
        "schema": INPUT_CLOSURE_SCHEMA,
        "file_count": len(entries),
        "aggregate_digest": _fingerprint(entries),
        "entries": entries,
    }


def _strip_declared_fields(value: Any, fields: frozenset[str]) -> Any:
    if isinstance(value, dict):
        return {key: _strip_declared_fields(item, fields) for key, item in value.items() if key not in fields}
    if isinstance(value, list):
        return [_strip_declared_fields(item, fields) for item in value]
    return value


def normalized_product_digest(path: Path) -> str:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PhaseBError(f"product is unreadable or malformed: {path.name}") from exc
    normalized = _strip_declared_fields(
        value,
        VOLATILE_FIELDS_BY_PRODUCT.get(path.name, frozenset()),
    )
    raw = json.dumps(normalized, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(raw.encode()).hexdigest()


def product_digest_map(directory: Path) -> dict[str, str]:
    products = sorted(directory.glob("*.json"))
    if not products:
        raise PhaseBError("generated product set is empty")
    if any(path.is_symlink() or not path.is_file() for path in products):
        raise PhaseBError("product set contains a non-regular node")
    return {path.name: normalized_product_digest(path) for path in products}


def plan_runtime(documents_root: Path, legacy_app_root: Path, state_root: Path) -> dict[str, Any]:
    documents = _regular_root(documents_root, "Documents root")
    legacy = _regular_root(legacy_app_root, "legacy app root")
    target = _regular_root(state_root, "state root", must_exist=False)
    if not legacy.is_relative_to(documents):
        raise PhaseBError("legacy app must be below Documents")
    if target.exists():
        raise PhaseBError("target must be absent")
    if target.is_relative_to(documents) or target.is_relative_to(legacy):
        raise PhaseBError("state root must be outside Documents")
    manifest_root = legacy / "data-manifest"
    manifests = [manifest_root / f"{name}.yaml" for name in MANIFEST_NAMES]
    if any(not path.is_file() or path.is_symlink() for path in manifests):
        raise PhaseBError("exact six manifests are required")
    for path in manifests:
        if not isinstance(yaml.safe_load(path.read_text(encoding="utf-8")), dict):
            raise PhaseBError("manifest must be a mapping")
    generated_root = legacy / "app-data"
    generated = sorted(path for path in generated_root.glob("*.json") if path.is_file() and not path.is_symlink())
    entries = [_entry(path, legacy) for path in [*manifests, *generated]]
    input_closure = builder_input_closure(documents, legacy)
    fingerprint_entries = [
        *entries,
        {
            "input_closure_digest": input_closure["aggregate_digest"],
            "input_closure_file_count": input_closure["file_count"],
        },
    ]
    disk_probe = target.parent
    while not disk_probe.exists() and disk_probe != disk_probe.parent:
        disk_probe = disk_probe.parent
    required_bytes = (
        sum(int(entry["bytes"]) for entry in entries)
        + 2 * sum(int(entry["bytes"]) for entry in input_closure["entries"])
        + 2 * sum(int(entry["bytes"]) for entry in entries)
        + 64 * 1024 * 1024
    )
    if shutil.disk_usage(disk_probe).free < required_bytes:
        raise PhaseBError("insufficient disk for runtime staging")
    return {
        "schema": PLAN_SCHEMA,
        "status": "planned",
        "state_root_ref": "runtime://family-hub/dashboard",
        "manifest_count": len(manifests),
        "legacy_generated_count": len(generated),
        "required_free_bytes": required_bytes,
        "entries": entries,
        "input_closure": input_closure,
        "fingerprint": _fingerprint(fingerprint_entries),
        "writes_documents": False,
    }


def plan_fingerprint(plan: dict[str, Any]) -> str:
    value = plan.get("fingerprint")
    if plan.get("schema") != PLAN_SCHEMA or not isinstance(value, str):
        raise PhaseBError("runtime plan is invalid")
    return value


def _atomic_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary_path = Path(temporary)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, sort_keys=True, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
    except BaseException:
        temporary_path.unlink(missing_ok=True)
        raise


def _seed_staging(staging: Path, legacy_app_root: Path, plan: dict[str, Any]) -> None:
    staging.mkdir(mode=0o700)
    (staging / "manifests").mkdir(mode=0o700)
    for name in MANIFEST_NAMES:
        destination = staging / "manifests" / f"{name}.yaml"
        shutil.copyfile(legacy_app_root / "data-manifest" / f"{name}.yaml", destination)
        destination.chmod(0o600)
    (staging / "cache").mkdir(mode=0o700)
    (staging / "migration").mkdir(mode=0o700)
    _atomic_json(staging / "migration" / "plan.json", plan)


def _mapping_digest(mapping: dict[str, str]) -> str:
    raw = json.dumps(mapping, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(raw.encode()).hexdigest()


def _assert_input_closure(
    expected: dict[str, Any],
    documents_root: Path,
    legacy_app_root: Path,
) -> None:
    if builder_input_closure(documents_root, legacy_app_root) != expected:
        raise PhaseBError("builder input closure changed")


def _run_build(build_runner: BuildRunner, documents_root: Path, staging: Path) -> None:
    try:
        build_runner(
            {
                "FAMILY_DOCUMENTS_ROOT": str(documents_root.resolve()),
                "FAMILY_DASHBOARD_STATE_ROOT": str(staging),
            }
        )
    except Exception as exc:
        raise PhaseBError("build failed") from exc


def apply_runtime(
    plan: dict[str, Any],
    *,
    documents_root: Path,
    legacy_app_root: Path,
    state_root: Path,
    expected_fingerprint: str,
    build_runner: BuildRunner,
) -> dict[str, Any]:
    fresh = plan_runtime(documents_root, legacy_app_root, state_root)
    if fresh != plan or plan_fingerprint(plan) != expected_fingerprint:
        raise PhaseBError("source changed after plan")
    target = state_root.expanduser().resolve()
    suffix = expected_fingerprint.removeprefix("sha256:")[:12]
    staging_a = target.parent / f".dashboard.staging-{suffix}-a"
    staging_b = target.parent / f".dashboard.staging-{suffix}-b"
    if staging_a.exists() or staging_b.exists() or target.exists():
        raise PhaseBError("state target collision")
    expected_closure = plan["input_closure"]
    try:
        staging_a.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
        _seed_staging(staging_a, legacy_app_root, plan)
        _seed_staging(staging_b, legacy_app_root, plan)
        _assert_input_closure(expected_closure, documents_root, legacy_app_root)
        _run_build(build_runner, documents_root, staging_a)
        _assert_input_closure(expected_closure, documents_root, legacy_app_root)
        _run_build(build_runner, documents_root, staging_b)
        _assert_input_closure(expected_closure, documents_root, legacy_app_root)

        fresh_a = product_digest_map(staging_a / "generated")
        fresh_b = product_digest_map(staging_b / "generated")
        if fresh_a.keys() != fresh_b.keys():
            raise PhaseBError("fresh build product set differs")
        fresh_differences = sorted(name for name in fresh_a if fresh_a[name] != fresh_b[name])
        if fresh_differences:
            raise PhaseBError(f"fresh build parity differs: {','.join(fresh_differences)}")

        legacy = product_digest_map(legacy_app_root / "app-data")
        if legacy.keys() != fresh_a.keys():
            raise PhaseBError("legacy product set differs")
        legacy_results = {name: "equal" if legacy[name] == fresh_a[name] else "different" for name in sorted(fresh_a)}
        parity = {
            "schema": "family-dashboard-parity/v2",
            "input_closure": {
                "status": "stable",
                "aggregate_digest": expected_closure["aggregate_digest"],
                "observation_count": 3,
            },
            "fresh_build": {
                "status": "equal",
                "product_count": len(fresh_a),
                "aggregate_digest": _mapping_digest(fresh_a),
            },
            "legacy_delta": {
                "status": "observed",
                "equal_count": sum(value == "equal" for value in legacy_results.values()),
                "different_count": sum(value == "different" for value in legacy_results.values()),
                "legacy_aggregate_digest": _mapping_digest(legacy),
                "fresh_aggregate_digest": _mapping_digest(fresh_a),
                "results": legacy_results,
            },
        }
        _atomic_json(staging_a / "migration" / "parity.json", parity)
        shutil.rmtree(staging_b)
        staging_a.chmod(0o700)
        for node in sorted(staging_a.rglob("*")):
            if node.is_symlink():
                raise PhaseBError("staging contains a symlink")
            node.chmod(0o700 if node.is_dir() else 0o600)
        os.replace(staging_a, target)
        receipt = verify_runtime(
            documents_root,
            legacy_app_root,
            target,
            expected_fingerprint=expected_fingerprint,
        )
        _atomic_json(target / "migration" / "receipt.json", receipt)
        return receipt
    except BaseException:
        for candidate in (staging_a, staging_b):
            if candidate.exists():
                shutil.rmtree(candidate)
        if target.exists() and not (target / "migration" / "receipt.json").exists():
            shutil.rmtree(target)
        raise


def verify_runtime(
    documents_root: Path,
    legacy_app_root: Path,
    state_root: Path,
    *,
    expected_fingerprint: str,
) -> dict[str, Any]:
    target = _regular_root(state_root, "state root")
    if not (target / "migration" / "parity.json").is_file():
        raise PhaseBError("parity receipt missing")
    manifests = sorted((target / "manifests").glob("*.yaml"))
    generated = sorted((target / "generated").glob("*.json"))
    if [path.stem for path in manifests] != sorted(MANIFEST_NAMES):
        raise PhaseBError("manifest set mismatch")
    plan_path = target / "migration" / "plan.json"
    try:
        bound_plan = json.loads(plan_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PhaseBError("bound runtime plan is invalid") from exc
    if plan_fingerprint(bound_plan) != expected_fingerprint:
        raise PhaseBError("bound runtime plan is invalid")
    if builder_input_closure(documents_root, legacy_app_root) != bound_plan.get("input_closure"):
        raise PhaseBError("Documents builder input closure changed")

    parity_path = target / "migration" / "parity.json"
    try:
        parity = json.loads(parity_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PhaseBError("parity receipt is invalid") from exc
    if parity.get("schema") != "family-dashboard-parity/v2":
        raise PhaseBError("parity receipt is invalid")
    if parity.get("input_closure", {}).get("status") != "stable":
        raise PhaseBError("input closure is not stable")
    if parity.get("fresh_build", {}).get("status") != "equal":
        raise PhaseBError("fresh build parity is not equal")
    if parity.get("legacy_delta", {}).get("status") != "observed":
        raise PhaseBError("legacy delta is missing")
    return {
        "schema": "family-dashboard-runtime-receipt/v1",
        "status": "verified",
        "source_fingerprint": expected_fingerprint,
        "manifest_count": len(manifests),
        "generated_count": len(generated),
        "cache_seed_count": 0,
        "writes_documents": False,
        "input_closure_digest": parity["input_closure"]["aggregate_digest"],
        "fresh_build_parity": "equal",
        "legacy_delta_status": "observed",
        "legacy_delta_count": parity["legacy_delta"]["different_count"],
    }
