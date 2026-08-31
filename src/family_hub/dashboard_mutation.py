from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any, Final

import yaml

from .dashboard_runtime import PhaseBError, _atomic_json

PROPOSAL_TYPE: Final = "family_dashboard_document_write"
ALLOWED_OPERATIONS: Final = {"replace_text", "vaccine_update", "milestone_achieve"}
ALLOWED_ROOTS: Final = ("_control/", "_entities/", "_knowledge/", "_meta/", "_storage/inbox/", "_storage/99-中转/")
ALLOWED_SUFFIXES: Final = {".md", ".markdown", ".yaml", ".yml", ".json", ".txt"}
PROPOSAL_ID_PATTERN: Final = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}")
CANARY_RELATIVE: Final = "_meta/family-dashboard-write-canary.md"
CANARY_CONTENT: Final = b"family-dashboard Phase B write canary\n"


def _sha_bytes(value: bytes) -> str:
    return "sha256:" + hashlib.sha256(value).hexdigest()


def _regular_configured_root(raw_value: str, label: str) -> Path:
    raw = Path(raw_value).expanduser()
    if raw.is_symlink() or not raw.is_dir():
        raise PhaseBError(f"{label} invalid")
    return raw.resolve()


def _require_disjoint_roots(documents_root: Path, state_root: Path) -> None:
    documents = documents_root.expanduser().resolve()
    state = state_root.expanduser().resolve()
    if state == documents or state.is_relative_to(documents) or documents.is_relative_to(state):
        raise PhaseBError("state root must be outside Documents")


def _require_state_path_without_symlinks(state: Path, *parts: str) -> Path:
    cursor = state
    for part in parts:
        cursor = cursor / part
        if cursor.is_symlink():
            raise PhaseBError("state path crosses a symlink")
    return cursor


def stage_payload(state_root: Path, proposal_id: str, content: bytes) -> dict[str, Any]:
    if PROPOSAL_ID_PATTERN.fullmatch(proposal_id) is None or not content or len(content) > 2_000_000:
        raise PhaseBError("proposal payload is invalid")
    raw_root = state_root.expanduser()
    if raw_root.is_symlink() or not raw_root.is_dir():
        raise PhaseBError("proposal state root invalid")
    root = raw_root.resolve()
    proposal_root = _require_state_path_without_symlinks(root, "proposals", proposal_id)
    path = proposal_root / "payload"
    metadata = {
        "payload_ref": path.relative_to(root).as_posix(),
        "payload_sha256": _sha_bytes(content),
        "payload_bytes": len(content),
    }
    if path.is_symlink():
        raise PhaseBError("proposal payload collision")
    if path.exists():
        if not path.is_file() or path.stat().st_mode & 0o777 != 0o600 or path.read_bytes() != content:
            raise PhaseBError("proposal payload collision")
        return metadata
    path.parent.mkdir(parents=True, mode=0o700)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    return metadata


def build_canary_proposal(documents_root: Path, state_root: Path, proposal_id: str) -> dict[str, Any]:
    _require_disjoint_roots(documents_root, state_root)
    relative = CANARY_RELATIVE
    target = _safe_target(documents_root, relative)
    if target.exists() or target.is_symlink():
        raise PhaseBError("canary target must be absent")
    staged = stage_payload(state_root, proposal_id, CANARY_CONTENT)
    base = {
        "id": proposal_id,
        "type": PROPOSAL_TYPE,
        "debt_id": "family-dashboard-content",
        "source": "family-dashboard-phase-b-operator",
        "target": f"documents://family/{relative}",
        "expected_change": "create and immediately roll back controlled canary",
        "operation_level": "L3",
        "approval_required": True,
        "rollback": "restore exact source absence in the same transaction",
        "verification": "verify apply, verify, rollback receipts and final absence",
        "auto_apply": "disabled",
        "operation": "replace_text",
        "target_relative": relative,
        "expected_source_exists": False,
        "expected_source_sha256": _sha_bytes(b""),
        "expected_source_mode": "0o600",
        "expected_source_bytes": 0,
        "canary_rollback": True,
        **staged,
    }
    canonical = json.dumps(base, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return {**base, "proposal_digest": _sha_bytes(canonical)}


def _safe_target(documents_root: Path, relative: str) -> Path:
    rel = Path(relative)
    if rel.is_absolute() or ".." in rel.parts or not relative.startswith(ALLOWED_ROOTS):
        raise PhaseBError("unsafe Documents target")
    if rel.suffix.lower() not in ALLOWED_SUFFIXES or rel.name.startswith("."):
        raise PhaseBError("unsafe Documents target")
    raw_root = documents_root.expanduser()
    if raw_root.is_symlink() or not raw_root.is_dir():
        raise PhaseBError("Documents root invalid")
    root = raw_root.resolve()
    target = (root / rel).resolve()
    if not target.is_relative_to(root):
        raise PhaseBError("unsafe Documents target")
    cursor = root
    for part in rel.parts:
        cursor = cursor / part
        if cursor.is_symlink():
            raise PhaseBError("Documents target crosses a symlink")
    return target


def _atomic_bytes(path: Path, content: bytes, mode: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary_path = Path(temporary)
    try:
        os.fchmod(fd, mode)
        with os.fdopen(fd, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
    except BaseException:
        temporary_path.unlink(missing_ok=True)
        raise


def _write_private_exclusive(path: Path, content: bytes) -> None:
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
    except BaseException:
        path.unlink(missing_ok=True)
        raise


def _proposal_id(proposal: dict[str, Any]) -> str:
    value = proposal.get("id")
    if not isinstance(value, str) or PROPOSAL_ID_PATTERN.fullmatch(value) is None:
        raise PhaseBError("proposal schema invalid")
    return value


def _acquire_target_guard(state: Path, target_relative: str) -> tuple[int, Path]:
    lock_root = state / "locks"
    if lock_root.is_symlink():
        raise PhaseBError("target mutation guard invalid")
    lock_root.mkdir(parents=True, mode=0o700, exist_ok=True)
    lock_root.chmod(0o700)
    lock_name = hashlib.sha256(target_relative.encode()).hexdigest() + ".lock"
    lock_path = lock_root / lock_name
    try:
        descriptor = os.open(lock_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        raise PhaseBError("target mutation busy") from exc
    return descriptor, lock_path


def _missing_parent_directories(target: Path, documents: Path) -> list[Path]:
    missing: list[Path] = []
    cursor = target.parent
    while cursor != documents and not cursor.exists():
        missing.append(cursor)
        cursor = cursor.parent
    if cursor != documents and not cursor.is_relative_to(documents):
        raise PhaseBError("unsafe Documents target")
    return missing


def _restore_absence(target: Path, created_directories: list[Path]) -> bool:
    try:
        target.unlink(missing_ok=True)
        for directory in created_directories:
            try:
                directory.rmdir()
            except FileNotFoundError:
                continue
            except OSError:
                return False
    except OSError:
        return False
    return not target.exists() and all(not directory.exists() for directory in created_directories)


def _execute_locked_mutation(
    proposal: dict[str, Any],
    *,
    proposal_id: str,
    target_relative: str,
    target: Path,
    proposed: bytes,
    documents: Path,
    state: Path,
) -> dict[str, Any]:
    existed = target.is_file()
    if target.exists() and not existed:
        raise PhaseBError("source CAS mismatch")
    original = target.read_bytes() if existed else b""
    canary_rollback = proposal.get("canary_rollback") is True
    if canary_rollback:
        if (
            proposal.get("source") != "family-dashboard-phase-b-operator"
            or proposal.get("debt_id") != "family-dashboard-content"
            or proposal.get("operation") != "replace_text"
            or proposal.get("operation_level") != "L3"
            or proposal.get("approval_required") is not True
            or proposal.get("auto_apply") != "disabled"
            or target_relative != CANARY_RELATIVE
            or proposed != CANARY_CONTENT
        ):
            raise PhaseBError("canary operator envelope invalid")
        if existed:
            raise PhaseBError("canary rollback requires exact absent target")
    source_mode = oct(target.stat().st_mode & 0o7777) if existed else "0o600"
    if (
        bool(proposal.get("expected_source_exists")) != existed
        or _sha_bytes(original) != proposal.get("expected_source_sha256")
        or len(original) != proposal.get("expected_source_bytes")
        or source_mode != proposal.get("expected_source_mode")
    ):
        raise PhaseBError("source CAS mismatch")
    created_directories = _missing_parent_directories(target, documents) if not existed else []
    mutation_root = _require_state_path_without_symlinks(state, "mutations", proposal_id)
    mutation_root.mkdir(parents=True, mode=0o700, exist_ok=False)
    original_path = mutation_root / "original"
    if existed:
        _write_private_exclusive(original_path, original)
    prepared = {
        "schema": "family-dashboard-mutation-prepared/v1",
        "proposal_id": proposal_id,
        "target_relative": target_relative,
        "source_sha256": _sha_bytes(original),
        "proposed_sha256": _sha_bytes(proposed),
        "source_existed": existed,
    }
    _atomic_json(mutation_root / "prepared.json", prepared)
    mode = target.stat().st_mode & 0o7777 if existed else 0o600
    try:
        _atomic_bytes(target, proposed, mode)
        if _sha_bytes(target.read_bytes()) != proposal["payload_sha256"]:
            raise PhaseBError("post-write verification failed")
        apply_receipt = {**prepared, "schema": "family-dashboard-mutation-apply/v1", "status": "applied"}
        verify_receipt = {**prepared, "schema": "family-dashboard-mutation-verify/v1", "status": "verified"}
        _atomic_json(mutation_root / "apply.json", apply_receipt)
        _atomic_json(mutation_root / "verify.json", verify_receipt)
        result = {
            "status": "verified",
            "proposal_id": proposal_id,
            "verify_receipt_ref": (mutation_root / "verify.json").relative_to(state).as_posix(),
            "verify_receipt_sha256": _sha_bytes((mutation_root / "verify.json").read_bytes()),
        }
        if canary_rollback:
            if not _restore_absence(target, created_directories):
                raise PhaseBError("canary rollback verification failed")
            rollback_receipt = {
                **prepared,
                "schema": "family-dashboard-mutation-rollback/v1",
                "status": "rolled_back",
            }
            _atomic_json(mutation_root / "rollback.json", rollback_receipt)
            result.update(
                {
                    "canary_rolled_back": True,
                    "rollback_receipt_ref": (mutation_root / "rollback.json").relative_to(state).as_posix(),
                    "rollback_receipt_sha256": _sha_bytes((mutation_root / "rollback.json").read_bytes()),
                }
            )
        return result
    except BaseException as exc:
        restored = False
        try:
            if existed:
                _atomic_bytes(target, original, mode)
            else:
                restored = _restore_absence(target, created_directories)
            if existed:
                restored = target.is_file() and target.read_bytes() == original
        except OSError:
            restored = False
        rollback_receipt = {
            **prepared,
            "schema": "family-dashboard-mutation-rollback/v1",
            "status": "rolled_back" if restored else "unknown",
        }
        try:
            _atomic_json(mutation_root / "rollback.json", rollback_receipt)
        except OSError as receipt_exc:
            raise PhaseBError("mutation final state unknown") from receipt_exc
        if not restored:
            raise PhaseBError("mutation final state unknown") from exc
        raise PhaseBError("mutation failed and rolled back") from exc


def execute_approved_mutation(args: dict[str, Any]) -> dict[str, Any]:
    proposal = args.get("proposal")
    if not isinstance(proposal, dict) or proposal.get("type") != PROPOSAL_TYPE:
        raise PhaseBError("proposal schema invalid")
    proposal_id = _proposal_id(proposal)
    if proposal.get("operation") not in ALLOWED_OPERATIONS:
        raise PhaseBError("proposal operation invalid")
    if proposal.get("status") != "approved" or not str(proposal.get("approved_by", "")).startswith(
        "operator://cockpit-api/"
    ):
        raise PhaseBError("verified human approval required")
    documents_raw = os.environ.get("FAMILY_DOCUMENTS_ROOT", "")
    state_raw = os.environ.get("FAMILY_DASHBOARD_STATE_ROOT", "")
    omo_raw = os.environ.get("OMO_DIR", "")
    if not documents_raw or not state_raw or not omo_raw:
        raise PhaseBError("mutation authority roots unavailable")
    documents = _regular_configured_root(documents_raw, "Documents root")
    state = _regular_configured_root(state_raw, "state root")
    omo = _regular_configured_root(omo_raw, "OMO root")
    _require_disjoint_roots(documents, state)
    approval_path = omo / "state" / "proposals" / f"{proposal_id}.processing"
    if not approval_path.is_file() or approval_path.is_symlink():
        raise PhaseBError("OMO approval record unavailable")
    approved = yaml.safe_load(approval_path.read_text(encoding="utf-8"))
    if approved != proposal:
        raise PhaseBError("OMO approval binding mismatch")
    target_relative = proposal.get("target_relative")
    if not isinstance(target_relative, str):
        raise PhaseBError("proposal schema invalid")
    if proposal.get("target") != f"documents://family/{target_relative}":
        raise PhaseBError("proposal target binding mismatch")
    target = _safe_target(documents, target_relative)
    payload_ref = proposal.get("payload_ref")
    if not isinstance(payload_ref, str):
        raise PhaseBError("payload ref invalid")
    relative_payload = Path(payload_ref)
    expected_payload = Path("proposals") / proposal_id / "payload"
    if relative_payload.is_absolute() or relative_payload.parts != expected_payload.parts:
        raise PhaseBError("payload ref invalid")
    payload_candidate = state / relative_payload
    cursor = state
    for part in relative_payload.parts:
        cursor = cursor / part
        if cursor.is_symlink():
            raise PhaseBError("payload ref invalid")
    payload = payload_candidate.resolve()
    if payload != (state / expected_payload).resolve() or not payload.is_file():
        raise PhaseBError("payload ref invalid")
    if payload.stat().st_mode & 0o777 != 0o600:
        raise PhaseBError("payload mode invalid")
    proposed = payload.read_bytes()
    if _sha_bytes(proposed) != proposal.get("payload_sha256") or len(proposed) != proposal.get("payload_bytes"):
        raise PhaseBError("payload drift")
    guard_descriptor, guard_path = _acquire_target_guard(state, target_relative)
    try:
        return _execute_locked_mutation(
            proposal,
            proposal_id=proposal_id,
            target_relative=target_relative,
            target=target,
            proposed=proposed,
            documents=documents,
            state=state,
        )
    finally:
        os.close(guard_descriptor)
        guard_path.unlink(missing_ok=True)
