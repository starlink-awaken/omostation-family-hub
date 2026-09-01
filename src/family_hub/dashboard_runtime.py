from __future__ import annotations

import hashlib
import json
import os
import shutil
import stat
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
PRODUCT_ROOT_SCHEMAS: Final = {
    "assets.json": dict,
    "build-meta.json": dict,
    "calendar.json": dict,
    "daily.json": dict,
    "finance.json": dict,
    "growth.json": dict,
    "health.json": dict,
    "links.json": dict,
    "members.json": dict,
    "milestones.json": dict,
    "search-chunks-embeddings.json": list,
    "search-chunks.json": list,
    "search-embeddings.json": list,
    "search-index.json": list,
    "summary.json": dict,
    "tags.json": dict,
    "tasks.json": list,
    "timeline.json": list,
    "vaccines.json": dict,
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


def _entry(path: Path, logical_path: str) -> dict[str, Any]:
    stat = path.stat(follow_symlinks=False)
    if not path.is_file() or path.is_symlink():
        raise PhaseBError("inventory contains a non-regular node")
    return {
        "path_digest": "sha256:" + hashlib.sha256(logical_path.encode()).hexdigest(),
        "sha256": _sha(path),
        "bytes": stat.st_size,
        "mode": oct(stat.st_mode & 0o7777),
    }


def _fingerprint(entries: list[dict[str, Any]]) -> str:
    raw = json.dumps(entries, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(raw.encode()).hexdigest()


def _canonical_digest(payload: Any) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
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
    root_schema = PRODUCT_ROOT_SCHEMAS.get(path.name)
    if root_schema is None:
        raise PhaseBError(f"unknown product: {path.name}")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PhaseBError(f"product is unreadable or malformed: {path.name}") from exc
    if not isinstance(value, root_schema):
        raise PhaseBError(f"product root schema mismatch: {path.name}")
    normalized = _strip_declared_fields(
        value,
        VOLATILE_FIELDS_BY_PRODUCT.get(path.name, frozenset()),
    )
    raw = json.dumps(normalized, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(raw.encode()).hexdigest()


def product_digest_map(directory: Path) -> dict[str, str]:
    if directory.is_symlink() or not directory.is_dir():
        raise PhaseBError("product directory must be a regular directory")
    products = sorted(directory.glob("*.json"))
    if not products:
        raise PhaseBError("generated product set is empty")
    if any(path.is_symlink() or not path.is_file() for path in products):
        raise PhaseBError("product set contains a non-regular node")
    return {path.name: normalized_product_digest(path) for path in products}


def canonical_plan_fingerprint(plan: dict[str, Any]) -> str:
    payload = {key: value for key, value in plan.items() if key != "fingerprint"}
    return _canonical_digest(payload)


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
    legacy_products = product_digest_map(generated_root)
    generated = [generated_root / name for name in legacy_products]
    entries = [
        *(_entry(path, f"manifest:{path.stem}") for path in manifests),
        *(_entry(path, f"legacy-product:{path.stem}") for path in generated),
    ]
    input_closure = builder_input_closure(documents, legacy)
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
    plan: dict[str, Any] = {
        "schema": PLAN_SCHEMA,
        "status": "planned",
        "state_root_ref": "runtime://family-hub/dashboard",
        "manifest_count": len(manifests),
        "legacy_generated_count": len(generated),
        "required_free_bytes": required_bytes,
        "entries": entries,
        "input_closure": input_closure,
        "writes_documents": False,
    }
    plan["fingerprint"] = canonical_plan_fingerprint(plan)
    return plan


def plan_fingerprint(plan: dict[str, Any]) -> str:
    value = plan.get("fingerprint")
    if plan.get("schema") != PLAN_SCHEMA or not isinstance(value, str):
        raise PhaseBError("runtime plan is invalid")
    if value != canonical_plan_fingerprint(plan):
        raise PhaseBError("runtime plan fingerprint mismatch")
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


def _parity_evidence(
    input_closure: dict[str, Any],
    fresh_products: dict[str, str],
    legacy_products: dict[str, str],
) -> dict[str, Any]:
    if legacy_products.keys() != fresh_products.keys():
        raise PhaseBError("legacy product set differs")
    product_set = sorted(fresh_products)
    legacy_results = {
        name: "equal" if legacy_products[name] == fresh_products[name] else "different" for name in product_set
    }
    fresh_digest = _mapping_digest(fresh_products)
    evidence: dict[str, Any] = {
        "schema": "family-dashboard-parity/v2",
        "input_closure": {
            "status": "stable",
            "aggregate_digest": input_closure["aggregate_digest"],
            "file_count": input_closure["file_count"],
            "observation_count": 3,
        },
        "fresh_build": {
            "status": "equal",
            "product_count": len(fresh_products),
            "product_set": product_set,
            "product_digests": fresh_products,
            "aggregate_digest": fresh_digest,
        },
        "legacy_delta": {
            "status": "observed",
            "product_count": len(legacy_products),
            "equal_count": sum(value == "equal" for value in legacy_results.values()),
            "different_count": sum(value == "different" for value in legacy_results.values()),
            "legacy_product_digests": legacy_products,
            "legacy_aggregate_digest": _mapping_digest(legacy_products),
            "fresh_aggregate_digest": fresh_digest,
            "results": legacy_results,
        },
    }
    evidence["evidence_digest"] = _canonical_digest(evidence)
    return evidence


def _assert_input_closure(
    expected: dict[str, Any],
    documents_root: Path,
    legacy_app_root: Path,
) -> None:
    if builder_input_closure(documents_root, legacy_app_root) != expected:
        raise PhaseBError("builder input closure changed")


def _exact_children(directory: Path, expected: set[str], label: str, *, directories: bool) -> dict[str, Path]:
    try:
        root_mode = os.lstat(directory).st_mode
    except OSError as exc:
        raise PhaseBError(f"staging {label} is invalid") from exc
    if not stat.S_ISDIR(root_mode):
        raise PhaseBError(f"staging {label} is invalid")
    children = {child.name: child for child in directory.iterdir()}
    if children.keys() != expected:
        raise PhaseBError(f"staging {label} mismatch")
    expected_kind = stat.S_ISDIR if directories else stat.S_ISREG
    for child in children.values():
        try:
            child_mode = os.lstat(child).st_mode
        except OSError as exc:
            raise PhaseBError(f"staging {label} contains an invalid node") from exc
        if not expected_kind(child_mode):
            raise PhaseBError(f"staging {label} contains a non-regular node")
    return children


def _expected_manifest_entries(plan: dict[str, Any]) -> dict[str, dict[str, Any]]:
    entries_by_digest = {entry.get("path_digest"): entry for entry in plan.get("entries", [])}
    expected: dict[str, dict[str, Any]] = {}
    for name in MANIFEST_NAMES:
        logical_path = f"manifest:{name}"
        path_digest = "sha256:" + hashlib.sha256(logical_path.encode()).hexdigest()
        entry = entries_by_digest.get(path_digest)
        if not isinstance(entry, dict):
            raise PhaseBError("runtime plan manifest binding is invalid")
        expected[name] = entry
    return expected


def _read_bound_json(path: Path, label: str) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PhaseBError(f"staging {label} is invalid") from exc
    if not isinstance(payload, dict):
        raise PhaseBError(f"staging {label} is invalid")
    return payload


def _validate_staging(
    staging: Path,
    *,
    legacy_app_root: Path,
    plan: dict[str, Any],
    products: dict[str, str],
    parity: dict[str, Any] | None,
) -> None:
    top_level = _exact_children(
        staging,
        {"manifests", "generated", "cache", "migration"},
        "layout",
        directories=True,
    )
    manifests = _exact_children(
        top_level["manifests"],
        {f"{name}.yaml" for name in MANIFEST_NAMES},
        "manifest set",
        directories=False,
    )
    expected_entries = _expected_manifest_entries(plan)
    for name in MANIFEST_NAMES:
        source = legacy_app_root / "data-manifest" / f"{name}.yaml"
        if _entry(source, f"manifest:{name}") != expected_entries[name]:
            raise PhaseBError(f"staging manifest source changed: {name}.yaml")
        staged = manifests[f"{name}.yaml"]
        if stat.S_IMODE(os.lstat(staged).st_mode) != 0o600 or _sha(staged) != _sha(source):
            raise PhaseBError(f"staging manifest differs: {name}.yaml")

    _exact_children(
        top_level["generated"],
        set(products),
        "generated set",
        directories=False,
    )
    if product_digest_map(top_level["generated"]) != products:
        raise PhaseBError("staging generated products changed")

    _exact_children(top_level["cache"], set(), "cache", directories=False)
    migration_names = {"plan.json"} if parity is None else {"plan.json", "parity.json"}
    migration = _exact_children(
        top_level["migration"],
        migration_names,
        "migration set",
        directories=False,
    )
    if _read_bound_json(migration["plan.json"], "migration plan") != plan:
        raise PhaseBError("staging migration plan differs")
    if parity is not None and _read_bound_json(migration["parity.json"], "parity evidence") != parity:
        raise PhaseBError("staging parity evidence differs")


def _remove_transaction_path(path: Path) -> None:
    try:
        mode = os.lstat(path).st_mode
    except FileNotFoundError:
        return
    if stat.S_ISDIR(mode):
        shutil.rmtree(path)
    else:
        path.unlink()


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
    transaction_state = "staging"
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
        parity = _parity_evidence(expected_closure, fresh_a, legacy)
        _atomic_json(staging_a / "migration" / "parity.json", parity)
        _assert_input_closure(expected_closure, documents_root, legacy_app_root)
        _validate_staging(
            staging_b,
            legacy_app_root=legacy_app_root,
            plan=plan,
            products=fresh_b,
            parity=None,
        )
        _remove_transaction_path(staging_b)
        _assert_input_closure(expected_closure, documents_root, legacy_app_root)
        _validate_staging(
            staging_a,
            legacy_app_root=legacy_app_root,
            plan=plan,
            products=fresh_a,
            parity=parity,
        )
        staging_a.chmod(0o700)
        for node in sorted(staging_a.rglob("*")):
            if node.is_symlink():
                raise PhaseBError("staging contains a symlink")
            node.chmod(0o700 if node.is_dir() else 0o600)
        os.replace(staging_a, target)
        transaction_state = "promoted"
        receipt = verify_runtime(
            documents_root,
            legacy_app_root,
            target,
            expected_fingerprint=expected_fingerprint,
        )
        _atomic_json(target / "migration" / "receipt.json", receipt)
        transaction_state = "receipt-written"
        return receipt
    except BaseException:
        for candidate in (staging_a, staging_b):
            _remove_transaction_path(candidate)
        if transaction_state in {"promoted", "receipt-written"}:
            _remove_transaction_path(target)
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
    current_closure = builder_input_closure(documents_root, legacy_app_root)
    if current_closure != bound_plan.get("input_closure"):
        raise PhaseBError("Documents builder input closure changed")

    parity_path = target / "migration" / "parity.json"
    try:
        parity = json.loads(parity_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PhaseBError("parity receipt is invalid") from exc
    promoted_products = product_digest_map(target / "generated")
    legacy_products = product_digest_map(legacy_app_root / "app-data")
    expected_parity = _parity_evidence(current_closure, promoted_products, legacy_products)
    if parity != expected_parity:
        raise PhaseBError("parity receipt is invalid")
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
