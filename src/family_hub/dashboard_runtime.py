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
    disk_probe = target.parent
    while not disk_probe.exists() and disk_probe != disk_probe.parent:
        disk_probe = disk_probe.parent
    required_bytes = sum(int(entry["bytes"]) for entry in entries) * 2 + 64 * 1024 * 1024
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
        "fingerprint": _fingerprint(entries),
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


def _normalized_json(path: Path) -> Any:
    value = json.loads(path.read_text(encoding="utf-8"))
    if path.name == "build-meta.json" and isinstance(value, dict):
        value = {key: item for key, item in value.items() if key != "builtAt"}
    if path.name in {
        "summary.json",
        "members.json",
        "health.json",
        "growth.json",
        "daily.json",
        "assets.json",
    } and isinstance(value, dict):
        value = {key: item for key, item in value.items() if key != "updatedAt"}
    return value


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
    staging = target.parent / f".dashboard.staging-{expected_fingerprint.removeprefix('sha256:')[:12]}"
    if staging.exists() or target.exists():
        raise PhaseBError("state target collision")
    try:
        (staging / "manifests").mkdir(parents=True)
        for name in MANIFEST_NAMES:
            destination = staging / "manifests" / f"{name}.yaml"
            shutil.copyfile(legacy_app_root / "data-manifest" / f"{name}.yaml", destination)
            destination.chmod(0o600)
        (staging / "cache").mkdir(mode=0o700)
        (staging / "migration").mkdir(mode=0o700)
        _atomic_json(staging / "migration" / "plan.json", plan)
        env = {
            "FAMILY_DOCUMENTS_ROOT": str(documents_root.resolve()),
            "FAMILY_DASHBOARD_STATE_ROOT": str(staging),
        }
        try:
            build_runner(env)
        except Exception as exc:
            raise PhaseBError("build failed") from exc
        staging.chmod(0o700)
        for node in sorted(staging.rglob("*")):
            if node.is_symlink():
                raise PhaseBError("staging contains a symlink")
            node.chmod(0o700 if node.is_dir() else 0o600)
        parity: dict[str, str] = {}
        for legacy_path in sorted((legacy_app_root / "app-data").glob("*.json")):
            generated_path = staging / "generated" / legacy_path.name
            if not generated_path.is_file():
                raise PhaseBError(f"generated product missing: {legacy_path.name}")
            parity[legacy_path.name] = (
                "equal" if _normalized_json(legacy_path) == _normalized_json(generated_path) else "different"
            )
        _atomic_json(
            staging / "migration" / "parity.json",
            {"schema": "family-dashboard-parity/v1", "results": parity},
        )
        differences = sorted(name for name, result in parity.items() if result != "equal")
        if differences:
            raise PhaseBError(f"normalized parity differs: {','.join(differences)}")
        os.replace(staging, target)
        receipt = verify_runtime(
            documents_root,
            legacy_app_root,
            target,
            expected_fingerprint=expected_fingerprint,
        )
        _atomic_json(target / "migration" / "receipt.json", receipt)
        return receipt
    except BaseException:
        if staging.exists():
            shutil.rmtree(staging)
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
    verification_target = target.parent / "verification-absent"
    source_entries = plan_runtime(documents_root, legacy_app_root, verification_target)["entries"]
    if _fingerprint(source_entries) != expected_fingerprint:
        raise PhaseBError("Documents source fingerprint changed")
    return {
        "schema": "family-dashboard-runtime-receipt/v1",
        "status": "verified",
        "source_fingerprint": expected_fingerprint,
        "manifest_count": len(manifests),
        "generated_count": len(generated),
        "cache_seed_count": 0,
        "writes_documents": False,
    }
