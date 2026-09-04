---
type: ssot
owner: governance-team
last_updated: 2026-09-03
---

# Family Hub API / Usage Reference

> Quick reference for using **Family Hub** programmatically and from the command line.

## Command Line

- `uv run python server.py` — start server
- `uv run pytest tests/` — run tests

## Programmatic API

Use the FastMCP server or import `family_hub` modules.

## Configuration

- Stack: python
- Dependencies: see [`../pyproject.toml`](../pyproject.toml) (Python) or [`../package.json`](../package.json) (TypeScript).
- Environment variables and ports: see workspace `protocols/port-registry.yaml` and root `.env.example`.

## Tests

See [`../README.md`](../README.md) for the test command.
