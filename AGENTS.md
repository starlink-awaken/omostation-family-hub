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
