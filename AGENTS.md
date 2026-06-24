# AGENTS.md — Family Hub

> eCOS v5 家庭应用 · React 前端 + FastMCP 家庭任务后端

## Quick Commands

```bash
cd projects/family-hub
bun install
bun run dev
bun run build
bun run lint
uv run python test_real_scenario.py
uv run python -m unittest discover -s tests -q
```

## Architecture

应用层项目，当前是双面结构：

```
前端: React + TypeScript + Vite
后端: FastMCP + SQLite
```

### 功能模块

| 模块 | 职责 |
|:-----|:------|
| 成员档案 | 家庭成员等级、积分、库存 |
| Quest 系统 | 创建、完成、积分结算 |
| 智能任务 | 通过 LLM Gateway 生成个性化任务 |
| 前端 UI | React 页面与展示层 |

## Dependencies

- Bun runtime, TypeScript, React, Vite
- uv, FastMCP, SQLite

## Testing

前端使用构建验证；后端使用最小场景脚本 + unittest。

```bash
bun run build
uv run python test_real_scenario.py
uv run python -m unittest discover -s tests -q
```

## Workspace-Wide Governance (2026-06-24)

This project follows the workspace-level governance conventions documented in the root `AGENTS.md`:

- **Agent Mutation Protocol**: Any autonomous agent/cron/daemon that modifies workspace state must emit `agent_mutation_intent`, avoid direct file I/O to `.omo/`/`spaces/`, and commit immediately. See `.omo/standards/agent-mutation-protocol.md` for the full protocol.
- **SSOT Guardian**: Run `python3 bin/ssot-guardian.py` from the workspace root before committing to detect task-count, current-wave, submodule-pointer, or direct-omo-io drift.
- **direct-omo-io**: Scripts must route writes to `.omo/` through `omo CLI`, `projects/omo` core, or `projects/c2g` ingress — never via raw `open()/mkdir()/write_text()`.
- **Submodule Governance**: Commit changes inside the submodule first, then bump the root-repo pointer; `git submodule status` with a `+` prefix indicates pending drift.
