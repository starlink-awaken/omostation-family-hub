# family-hub — System Boundary

> 本文档描述 family-hub 与 eCOS 系统其他部分的边界：暴露的接口、依赖的上游、影响的下游。
>
> 系统全景参见：[`../../docs/PANORAMA.md`](../../docs/PANORAMA.md)

---

## 1. 暴露接口

### BOS URI



### 入口

- **Frontend dev**: `bun run dev` Vite
- **HTTP API**: `bun run api` :3001
- **MCP stdio**: `uv run python mcp_server.py` 

## 2. 上游依赖

- gbrain (L2)
- aetherforge-gateway (aetherforge/packages/gateway/)

## 3. 下游影响



## 4. 配置 / SSOT

- 项目源码：`projects/family-hub/`
- 入口定义：`projects/family-hub/pyproject.toml` 或 `package.json`
- 测试：`cd projects/family-hub && bun run build && uv run python -m unittest discover -s tests -q`

## 架构演进与项目边界索引

参见工作区架构演进与项目边界：[`../../docs/ARCHITECTURE-EVOLUTION.md`](../../docs/ARCHITECTURE-EVOLUTION.md)
