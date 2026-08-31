from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path
from typing import Any

from .dashboard_mutation import build_canary_proposal
from .dashboard_runtime import (
    PLAN_SCHEMA,
    BuildRunner,
    PhaseBError,
    apply_runtime,
    plan_fingerprint,
    plan_runtime,
    verify_runtime,
)


def _bun_build_runner(app_root: Path) -> BuildRunner:
    def run(env: dict[str, str]) -> None:
        completed = subprocess.run(
            ["bun", "run", "scripts/verify-paths.ts"],
            cwd=app_root,
            env={"PATH": os.environ.get("PATH", ""), **env},
            check=False,
        )
        if completed.returncode != 0:
            raise PhaseBError("path verification failed")
        subprocess.run(
            ["bun", "run", "scripts/build-all.ts"],
            cwd=app_root,
            env={"PATH": os.environ.get("PATH", ""), **env},
            check=True,
        )

    return run


def _load_bound_plan(state_root: Path) -> dict[str, Any]:
    path = state_root / "migration" / "plan.json"
    if not path.is_file() or path.is_symlink():
        raise PhaseBError("bound runtime plan missing")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PhaseBError("bound runtime plan is invalid") from exc
    if not isinstance(payload, dict):
        raise PhaseBError("bound runtime plan is invalid")
    if payload.get("schema") != PLAN_SCHEMA or payload.get("state_root_ref") != "runtime://family-hub/dashboard":
        raise PhaseBError("bound runtime plan is invalid")
    plan_fingerprint(payload)
    return payload


def _emit(payload: dict[str, Any], *, as_json: bool, default_key: str) -> None:
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True) if as_json else payload[default_key])


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="family-dashboard-phase-b")
    sub = parser.add_subparsers(dest="command", required=True)
    plan = sub.add_parser("plan-runtime")
    plan.add_argument("--documents-root", type=Path, required=True)
    plan.add_argument("--legacy-app-root", type=Path, required=True)
    plan.add_argument("--state-root", type=Path, required=True)
    plan.add_argument("--json", action="store_true")

    apply = sub.add_parser("apply-runtime")
    apply.add_argument("--documents-root", type=Path, required=True)
    apply.add_argument("--legacy-app-root", type=Path, required=True)
    apply.add_argument("--state-root", type=Path, required=True)
    apply.add_argument("--expected-fingerprint", required=True)
    apply.add_argument("--app-root", type=Path, required=True)
    apply.add_argument("--json", action="store_true")

    verify = sub.add_parser("verify-runtime")
    verify.add_argument("--documents-root", type=Path, required=True)
    verify.add_argument("--state-root", type=Path, required=True)
    verify.add_argument("--json", action="store_true")

    canary = sub.add_parser("plan-canary")
    canary.add_argument("--documents-root", type=Path, required=True)
    canary.add_argument("--state-root", type=Path, required=True)
    canary.add_argument("--proposal-id", required=True)
    canary.add_argument("--output", type=Path, required=True)
    canary.add_argument("--json", action="store_true")

    args = parser.parse_args(argv)
    if args.command == "plan-canary":
        proposal = build_canary_proposal(args.documents_root, args.state_root, args.proposal_id)
        raw_state = args.state_root.expanduser()
        if raw_state.is_symlink() or not raw_state.is_dir():
            raise PhaseBError("canary state root invalid")
        state = raw_state.resolve()
        raw_output = args.output.expanduser()
        output = raw_output.resolve()
        if raw_output.is_symlink() or not output.is_relative_to(state) or output.exists():
            raise PhaseBError("canary proposal output must be a new state-root file")
        output.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
        descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                json.dump(proposal, handle, ensure_ascii=False, sort_keys=True, indent=2)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
        except BaseException:
            output.unlink(missing_ok=True)
            raise
        _emit(
            {
                "status": "planned",
                "proposal_id": proposal["id"],
                "proposal_digest": proposal["proposal_digest"],
            },
            as_json=args.json,
            default_key="proposal_digest",
        )
        return 0
    if args.command == "plan-runtime":
        payload = plan_runtime(args.documents_root, args.legacy_app_root, args.state_root)
        _emit(payload, as_json=args.json, default_key="fingerprint")
        return 0
    if args.command == "apply-runtime":
        payload = plan_runtime(args.documents_root, args.legacy_app_root, args.state_root)
        receipt = apply_runtime(
            payload,
            documents_root=args.documents_root,
            legacy_app_root=args.legacy_app_root,
            state_root=args.state_root,
            expected_fingerprint=args.expected_fingerprint,
            build_runner=_bun_build_runner(args.app_root),
        )
        _emit(receipt, as_json=args.json, default_key="source_fingerprint")
        return 0
    bound_plan = _load_bound_plan(args.state_root)
    fingerprint = plan_fingerprint(bound_plan)
    receipt = verify_runtime(
        args.documents_root,
        args.documents_root / "family-dashboard-app",
        args.state_root,
        expected_fingerprint=fingerprint,
    )
    _emit(receipt, as_json=args.json, default_key="source_fingerprint")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
