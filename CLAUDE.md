---
type: ssot
owner: governance-team
last_updated: 2026-09-03
last-reviewed: 2026-09-18

---

# CLAUDE.md — Family Hub AI Context

> Session loader for AI work inside `family-hub`.
> Keep durable engineering rules in [`AGENTS.md`](AGENTS.md) and volatile facts in SSOT files.

## Load First

1. [`AGENTS.md`](AGENTS.md)
2. [`README.md`](README.md)
3. The source files and tests directly related to the task
4. Workspace context in [`../../CLAUDE.md`](../../CLAUDE.md) when the task crosses project boundaries

## Project Role

- Layer: X
- Responsibility: 家庭数字枢纽与本地家庭任务/数据服务
- Stack: Python / FastMCP

## Commands

```bash
uv sync
uv run pytest "tests/" -q
```

## Safe Editing Rules

- 本地 SQLite/家庭数据不要提交。
- LLM Gateway 地址以环境变量和端口注册表为准。
- Do not commit, push, reset, or bump submodule pointers unless the user explicitly asks.
- Preserve unrelated dirty changes in this repository.
- Keep Markdown pointed at SSOT files instead of copying generated facts.

## Closeout

```bash
git status --short
uv run --with "pyyaml" python "../../bin/ssot/doc-ssot-lint.py" --json
```

Report the checks you actually ran and any pre-existing dirty state that remains.
