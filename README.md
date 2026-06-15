# Family Hub

家庭应用仓，当前包含两部分：

- 前端：React + TypeScript + Vite
- 后端：FastMCP + SQLite，用于家庭成员档案、任务与积分

## 常用命令

```bash
bun run dev
bun run build
uv run python test_real_scenario.py
uv run python -m unittest discover -s tests -q
```

## 后端能力

- `get_health`
- `get_profiles`
- `get_active_quests`
- `create_quest`
- `complete_quest`
- `generate_smart_quests`

`generate_smart_quests` 通过 `http://localhost:9290/v1/generate` 调用 LLM Gateway，并把返回的任务写入本地 SQLite。

## 本地文件

- `family_hub.db` 为本地运行时数据库，不纳入版本控制
- `tests/` 为后端最小验证集
