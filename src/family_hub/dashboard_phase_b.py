from __future__ import annotations

import argparse
import json
from pathlib import Path

from .dashboard_runtime import plan_runtime


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="family-dashboard-phase-b")
    sub = parser.add_subparsers(dest="command", required=True)
    plan = sub.add_parser("plan-runtime")
    plan.add_argument("--documents-root", type=Path, required=True)
    plan.add_argument("--legacy-app-root", type=Path, required=True)
    plan.add_argument("--state-root", type=Path, required=True)
    plan.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    payload = plan_runtime(args.documents_root, args.legacy_app_root, args.state_root)
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True) if args.json else payload["fingerprint"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
