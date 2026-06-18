# family-hub — Architecture

> **Layer**: X 横切框架  
> **Role**: 家庭数字枢纽 — 家庭任务 gamification  
> **Stack**: React 19 + Vite + Express 5 + Python FastMCP + SQLite  
> **Health**: See local scenario verification
> **SSOT**: 运行时健康、场景验证状态以本项目本地验证和 workspace governance SSOT 为准
>
> 系统全景参见：[`docs/ARCHITECTURE-DIAGRAM.md`](../docs/ARCHITECTURE-DIAGRAM.md)

---

## 1. 内部架构

```mermaid

graph LR
    UI[React App] --> API[Express :3001]
    API --> DB[(family_hub.db)]
    API --> GBR[gbrain]
    MCP[mcp_server.py] --> DB
    MCP --> LLM[llm-gateway]

```

## 2. 入口

| Type | Entry | Port / Notes |
|:--|:--|:--|
| Frontend dev | `bun run dev` | Vite |
| HTTP API | `bun run api` | :3001 |
| MCP stdio | `uv run python mcp_server.py` |  |

## 3. 核心模块

| Module | Responsibility |
|:--|:--|
| `mcp_server.py` | FastMCP server: profiles/quests/rewards |
| `api/server.ts` | Express API + gbrain sync |
| `src/App.tsx` | React UI |
| `test_real_scenario.py` | Scenario test |

## 4. 测试

```bash
cd projects/family-hub && bun run build && uv run python -m unittest discover -s tests -q
```
