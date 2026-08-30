# Family Hub

🌐 [简体中文](README.zh.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Contributing](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Security](https://img.shields.io/badge/security-policy-blue.svg)](SECURITY.md)
[![Python](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/)
[![uv](https://img.shields.io/badge/uv-package%20manager-purple.svg)](https://docs.astral.sh/uv/)

    > X · 家庭数字枢纽与本地家庭任务/数据服务
    > Metadata SSOT: [`../../docs/project-registry.yaml`](../../docs/project-registry.yaml)

## What It Owns

Family Hub owns the family task/API/MCP services and the canonical Next.js dashboard source at `apps/dashboard/`.

The dashboard reads household documents only through explicit `FAMILY_DOCUMENTS_ROOT` and keeps generated state under `FAMILY_DASHBOARD_STATE_ROOT`. Direct Documents writes are disabled until a later OMO proposal/approval phase. Cockpit cutover, live runtime relocation, and retirement of the legacy Documents app are not claimed by this source-owner phase.

    ## Installation

```bash
# Clone the workspace recursively
git clone --recursive https://github.com/starlink-awaken/omostation.git
cd omostation/projects/family-hub

# Install dependencies with uv
uv sync
```

Requires Python 3.13+ (see `pyproject.toml`).

## Quick Start

    ```bash
    uv sync
uv run pytest "tests/" -q
    ```

## Key Surfaces

- `src/` — existing Vite quest UI and Python package
- `api/server.ts` — existing Express API
- `mcp_server.py` — FastMCP service
- `apps/dashboard/` — canonical Next.js family dashboard source

## Dashboard Verification

```bash
bun --cwd apps/dashboard install --frozen-lockfile
bun --cwd apps/dashboard run test
bun --cwd apps/dashboard run lint
bun --cwd apps/dashboard run build
bun --cwd apps/dashboard run test:e2e
```

## Documentation

    - Developer guide: [`AGENTS.md`](AGENTS.md)
    - AI context loader: [`CLAUDE.md`](CLAUDE.md) when present
    - Workspace architecture: [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md)
    - Layer placement: [`../../LAYER-INDEX.md`](../../LAYER-INDEX.md)

    ## SSOT Rules

    Runtime facts, counts, ports, health, and generated inventories are intentionally not maintained here. Use the workspace registries and project source as the truth.
## Project Governance

- [Maintainers](MAINTAINERS.md)
- [Acknowledgments](ACKNOWLEDGMENTS.md)

- [Development](docs/DEVELOPMENT.md)
- [Release Process](RELEASE.md)

- [Governance](GOVERNANCE.md)
- [Support](SUPPORT.md)

- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [License](LICENSE)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Contributors](CONTRIBUTORS.md)
## Getting Help

- [FAQ](docs/FAQ.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [API / Usage Reference](docs/API.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
