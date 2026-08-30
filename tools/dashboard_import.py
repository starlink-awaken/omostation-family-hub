"""Deterministic, privacy-safe import of the legacy family dashboard source."""

from __future__ import annotations

import json
import os
import shutil
import stat
import uuid
from collections.abc import Iterable
from dataclasses import asdict, dataclass
from hashlib import sha256
from pathlib import Path, PurePosixPath
from typing import Any

import yaml

SCHEMA = "family-dashboard-import-plan/v1"
SANITIZE_TRANSFORM = "private-token-substitution/v1"

ALLOWED_ROOTS = frozenset({"src", "scripts", "public", "e2e", "_deploy"})
ALLOWED_FILES = frozenset(
    {
        ".dockerignore",
        ".env.example",
        ".gitignore",
        "CRON_SETUP.md",
        "README.md",
        "bun.lock",
        "docker-compose.yml",
        "eslint.config.mjs",
        "next.config.ts",
        "package.json",
        "playwright.config.ts",
        "postcss.config.mjs",
        "tsconfig.json",
        "vitest.config.ts",
        "vitest.setup.ts",
    }
)
FORBIDDEN_PARTS = frozenset(
    {
        ".local-audit",
        ".next",
        ".trae",
        "_docs",
        "app-data",
        "build",
        "coverage",
        "data-manifest",
        "node_modules",
        "out",
        "test-results",
    }
)
FORBIDDEN_NAMES = frozenset({".DS_Store", ".auth.json", ".env.local", "tsconfig.tsbuildinfo"})
FORBIDDEN_ROOT_FILES = frozenset({"AGENTS.md", "CLAUDE.md", "next-env.d.ts"})
FORBIDDEN_RELATIVE_PATHS = frozenset({"public/tailwind.css"})


class ImportClosedError(RuntimeError):
    """Raised when import safety or parity cannot be proved."""


@dataclass(frozen=True, slots=True)
class FileRecord:
    relative_path: str
    mode: int
    size: int
    sha256: str

    def to_public_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class SanitizedRecord:
    relative_path: str
    mode: int
    source_size: int
    source_sha256: str
    target_size: int
    target_sha256: str
    transform: str = SANITIZE_TRANSFORM

    def to_public_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class ImportPlan:
    schema: str
    files: tuple[FileRecord, ...]
    sanitized_files: tuple[SanitizedRecord, ...]
    selected_count: int
    selected_bytes: int
    selected_fingerprint: str
    full_source_count: int
    full_source_bytes: int
    full_source_fingerprint: str
    excluded_counts: dict[str, int]
    redaction_map_digest: str

    def to_public_dict(self) -> dict[str, Any]:
        return {
            "schema": self.schema,
            "files": [record.to_public_dict() for record in self.files],
            "sanitized_files": [record.to_public_dict() for record in self.sanitized_files],
            "selected_count": self.selected_count,
            "selected_bytes": self.selected_bytes,
            "selected_fingerprint": self.selected_fingerprint,
            "full_source_count": self.full_source_count,
            "full_source_bytes": self.full_source_bytes,
            "full_source_fingerprint": self.full_source_fingerprint,
            "excluded_counts": dict(sorted(self.excluded_counts.items())),
            "redaction_map_digest": self.redaction_map_digest,
        }


@dataclass(frozen=True, slots=True)
class ApplyResult:
    copied_files: tuple[FileRecord, ...]
    sanitized_files: tuple[SanitizedRecord, ...]


@dataclass(frozen=True, slots=True)
class VerificationResult:
    ok: bool
    selected_count: int
    selected_fingerprint: str
    full_source_fingerprint: str


@dataclass(frozen=True, slots=True)
class RedactionMapResult:
    replacements: dict[str, str]
    public_summary: dict[str, int | str]


def _digest_bytes(data: bytes) -> str:
    return sha256(data).hexdigest()


def _digest_file(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _mapping_digest(replacements: dict[str, str]) -> str:
    encoded = json.dumps(replacements, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return _digest_bytes(encoded)


def _canonical_fingerprint(records: Iterable[dict[str, Any]]) -> str:
    ordered = sorted(records, key=lambda item: str(item["relative_path"]))
    encoded = json.dumps(ordered, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return _digest_bytes(encoded)


def _record(path: Path, relative_path: str) -> FileRecord:
    metadata = path.lstat()
    if not stat.S_ISREG(metadata.st_mode):
        raise ImportClosedError(f"unsafe node: {relative_path}")
    return FileRecord(
        relative_path=relative_path,
        mode=stat.S_IMODE(metadata.st_mode),
        size=metadata.st_size,
        sha256=_digest_file(path),
    )


def _iter_regular_files(root: Path) -> tuple[FileRecord, ...]:
    if not root.is_dir() or root.is_symlink():
        raise ImportClosedError(f"source is not a safe directory: {root}")
    records: list[FileRecord] = []
    for current, dirnames, filenames in os.walk(root, followlinks=False):
        current_path = Path(current)
        for dirname in sorted(dirnames):
            directory = current_path / dirname
            relative = directory.relative_to(root).as_posix()
            if directory.is_symlink():
                raise ImportClosedError(f"unsafe node: {relative}")
        for filename in sorted(filenames):
            file_path = current_path / filename
            relative = file_path.relative_to(root).as_posix()
            records.append(_record(file_path, relative))
    return tuple(sorted(records, key=lambda record: record.relative_path))


def _forbidden_category(relative: PurePosixPath) -> str | None:
    relative_text = relative.as_posix()
    if relative.name in FORBIDDEN_NAMES or relative_text in FORBIDDEN_ROOT_FILES:
        return "forbidden_name"
    if (
        relative_text in FORBIDDEN_RELATIVE_PATHS
        or any(part in FORBIDDEN_PARTS for part in relative.parts)
        or (relative.parts[:3] == ("src", "app", "data") and relative.suffix == ".json")
        or (relative.name.startswith(".env") and relative.name != ".env.example")
        or relative.suffix == ".tsbuildinfo"
    ):
        return "runtime_or_private"
    return None


def _is_allowed(relative: PurePosixPath) -> bool:
    return relative.as_posix() in ALLOWED_FILES or relative.parts[0] in ALLOWED_ROOTS


def _redact(raw: bytes, replacements: dict[str, str]) -> bytes:
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ImportClosedError("private token found in non-UTF-8 file") from exc
    for token in sorted(replacements, key=len, reverse=True):
        replacement = replacements[token]
        if not token or not replacement:
            raise ImportClosedError("redaction map contains an empty token or replacement")
        text = text.replace(token, replacement)
    if any(token in text for token in replacements):
        raise ImportClosedError("private token remains after substitution")
    return text.encode("utf-8")


def derive_redaction_map(source: Path) -> RedactionMapResult:
    manifest = source / "data-manifest" / "members.yaml"
    if not manifest.is_file() or manifest.is_symlink():
        raise ImportClosedError("members manifest is required to derive private tokens")
    loaded: Any = yaml.safe_load(manifest.read_text(encoding="utf-8"))
    names: set[str] = set()

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                if key == "name" and isinstance(child, str) and child.strip():
                    names.add(child.strip())
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(loaded)
    replacements = {name: f"Synthetic Member {index:02d}" for index, name in enumerate(sorted(names), start=1)}
    documents_dir = next(
        (parent for parent in source.resolve().parents if parent.name == "Documents"),
        None,
    )
    if documents_dir is not None:
        replacements[str(documents_dir)] = "/absolute/path/to/read-only/documents"
    if not replacements:
        raise ImportClosedError("no private tokens derived")
    return RedactionMapResult(
        replacements=replacements,
        public_summary={
            "replacement_count": len(replacements),
            "sha256": _mapping_digest(replacements),
        },
    )


def plan_import(
    source: Path,
    target: Path,
    *,
    replacements: dict[str, str],
    required_private_tokens: tuple[str, ...] | None = None,
) -> ImportPlan:
    del target  # Target absence/collision is checked by apply; planning is read-only.
    full_records = _iter_regular_files(source)
    exact_files: list[FileRecord] = []
    sanitized_files: list[SanitizedRecord] = []
    excluded_counts: dict[str, int] = {}
    required_tokens = tuple(required_private_tokens or replacements.keys())

    for record in full_records:
        relative = PurePosixPath(record.relative_path)
        category = _forbidden_category(relative)
        if category is not None:
            excluded_counts[category] = excluded_counts.get(category, 0) + 1
            continue
        if not _is_allowed(relative):
            raise ImportClosedError(f"unknown root: {record.relative_path}")
        raw = (source / record.relative_path).read_bytes()
        matched_tokens = tuple(token for token in required_tokens if token and token.encode("utf-8") in raw)
        unmapped = tuple(token for token in matched_tokens if token not in replacements)
        if unmapped:
            raise ImportClosedError(f"unmapped private token: {record.relative_path}")
        if matched_tokens:
            transformed = _redact(raw, replacements)
            sanitized_files.append(
                SanitizedRecord(
                    relative_path=record.relative_path,
                    mode=record.mode,
                    source_size=record.size,
                    source_sha256=record.sha256,
                    target_size=len(transformed),
                    target_sha256=_digest_bytes(transformed),
                )
            )
        else:
            exact_files.append(record)

    public_selected = [record.to_public_dict() for record in exact_files]
    public_selected.extend(record.to_public_dict() for record in sanitized_files)
    return ImportPlan(
        schema=SCHEMA,
        files=tuple(exact_files),
        sanitized_files=tuple(sanitized_files),
        selected_count=len(exact_files) + len(sanitized_files),
        selected_bytes=sum(record.size for record in exact_files)
        + sum(record.target_size for record in sanitized_files),
        selected_fingerprint=_canonical_fingerprint(public_selected),
        full_source_count=len(full_records),
        full_source_bytes=sum(record.size for record in full_records),
        full_source_fingerprint=_canonical_fingerprint(record.to_public_dict() for record in full_records),
        excluded_counts=dict(sorted(excluded_counts.items())),
        redaction_map_digest=_mapping_digest(replacements),
    )


def _assert_source_unchanged(plan: ImportPlan, source: Path) -> None:
    current = _iter_regular_files(source)
    fingerprint = _canonical_fingerprint(record.to_public_dict() for record in current)
    if (
        len(current) != plan.full_source_count
        or sum(record.size for record in current) != plan.full_source_bytes
        or fingerprint != plan.full_source_fingerprint
    ):
        raise ImportClosedError("source drift")


def _quarantine_incomplete_target(target: Path) -> None:
    if not target.exists():
        return
    quarantine = target.with_name(f"{target.name}.failed-{uuid.uuid4().hex}")
    os.replace(target, quarantine)


def apply_import(
    plan: ImportPlan,
    source: Path,
    target: Path,
    *,
    replacements: dict[str, str],
) -> ApplyResult:
    if target.exists():
        raise ImportClosedError("destination collision")
    _assert_source_unchanged(plan, source)
    if _mapping_digest(replacements) != plan.redaction_map_digest:
        raise ImportClosedError("redaction map drift")

    copied: list[FileRecord] = []
    sanitized: list[SanitizedRecord] = []
    try:
        target.mkdir(parents=True, exist_ok=False)
        for expected in plan.files:
            source_file = source / expected.relative_path
            if _record(source_file, expected.relative_path) != expected:
                raise ImportClosedError(f"source drift: {expected.relative_path}")
            destination = target / expected.relative_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            with source_file.open("rb") as reader, destination.open("xb") as writer:
                shutil.copyfileobj(reader, writer)
            destination.chmod(expected.mode)
            actual = _record(destination, expected.relative_path)
            if actual != expected:
                raise ImportClosedError(f"target parity mismatch: {expected.relative_path}")
            copied.append(actual)

        for expected in plan.sanitized_files:
            source_file = source / expected.relative_path
            raw = source_file.read_bytes()
            if _digest_bytes(raw) != expected.source_sha256:
                raise ImportClosedError(f"source drift: {expected.relative_path}")
            transformed = _redact(raw, replacements)
            if len(transformed) != expected.target_size or _digest_bytes(transformed) != expected.target_sha256:
                raise ImportClosedError(f"sanitized target drift: {expected.relative_path}")
            destination = target / expected.relative_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open("xb") as writer:
                writer.write(transformed)
            destination.chmod(expected.mode)
            sanitized.append(expected)
    except Exception:
        _quarantine_incomplete_target(target)
        raise

    return ApplyResult(tuple(copied), tuple(sanitized))


def verify_import(
    plan: ImportPlan,
    source: Path,
    target: Path,
    *,
    replacements: dict[str, str],
) -> VerificationResult:
    _assert_source_unchanged(plan, source)
    if _mapping_digest(replacements) != plan.redaction_map_digest:
        raise ImportClosedError("redaction map drift")
    expected_paths = {record.relative_path for record in plan.files}
    expected_paths.update(record.relative_path for record in plan.sanitized_files)
    actual_records = _iter_regular_files(target)
    actual_paths = {record.relative_path for record in actual_records}
    extras = sorted(actual_paths - expected_paths)
    missing = sorted(expected_paths - actual_paths)
    if extras:
        raise ImportClosedError(f"unexpected target path: {extras[0]}")
    if missing:
        raise ImportClosedError(f"missing target path: {missing[0]}")
    for expected in plan.files:
        if _record(target / expected.relative_path, expected.relative_path) != expected:
            raise ImportClosedError(f"target drift: {expected.relative_path}")
    for expected in plan.sanitized_files:
        target_record = _record(target / expected.relative_path, expected.relative_path)
        if (
            target_record.mode != expected.mode
            or target_record.size != expected.target_size
            or target_record.sha256 != expected.target_sha256
        ):
            raise ImportClosedError(f"sanitized target drift: {expected.relative_path}")
    return VerificationResult(
        ok=True,
        selected_count=plan.selected_count,
        selected_fingerprint=plan.selected_fingerprint,
        full_source_fingerprint=plan.full_source_fingerprint,
    )


def write_receipt(plan: ImportPlan, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(plan.to_public_dict(), ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    with output.open("x", encoding="utf-8") as handle:
        handle.write(payload)
