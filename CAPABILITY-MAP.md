# Family-Hub 能力地图

> 家庭中心 · 任务 gamification 与成长激励

---

## 一、架构定位

```
┌─────────────────────────────────────────────────────────────┐
│                    Family-Hub — 家庭中心                      │
├─────────────────────────────────────────────────────────────┤
│  任务面板  │  角色切换  │  积分成长  │  每周报告 / AI 导师         │
│  Quests   │  Profiles │  Points   │  Weekly Report / Mentor   │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、当前已实现功能

| 功能 | 说明 |
|------|------|
| 家庭成员档案 | 孩子/家长角色切换，个性化任务面板 |
| 任务派发与完成 | 创建、完成家庭任务，积分奖励 |
| 积分与等级 | 完成任务获得积分，累计升级 |
| 随机盲盒奖励 | 任务完成后触发惊喜奖励动画 |
| 每周成长报告 | 统计任务完成情况，AI 导师生成鼓励报告 |
| 家庭驾驶舱源码 owner | `apps/dashboard` 持有 Next.js 页面/API/搜索/健康/成长/资产等源码；当前仅完成源码 owner 与合成验证 |

> 说明：家庭管理、日程、健康、财务等 dashboard 源码已归入本仓，但 live runtime、Cockpit 切换和旧应用退役仍需后续阶段证明。

---

## 三、技术栈

- React 19 + Vite 8 + TypeScript（前端）
- Express 5 + `bun:sqlite`（HTTP API）
- Python 3.13 + FastMCP（MCP 服务）
- Bun 运行时
- Next.js 16（`apps/dashboard` 独立 nested package）

---

## 四、项目结构

| 路径 | 说明 |
|------|------|
| `src/App.tsx` | React 主界面 |
| `src/main.tsx` | React 应用入口 |
| `api/server.ts` | Express HTTP API |
| `mcp_server.py` | FastMCP 服务入口 |
| `tests/test_mcp_server.py` | MCP 服务单元测试 |
| `family_hub.db` | 本地 SQLite 数据文件 |

---

## 五、测试覆盖

| 模块 | 测试文件 | 说明 |
|------|----------|------|
| MCP 服务 | `tests/test_mcp_server.py` | 工具调用与数据模型基础测试 |

---

## 六、内部依赖

| 依赖目标 | 方式 | 说明 |
|----------|------|------|
| `gbrain` | 可选 HTTP / CLI | 完成任务时尝试写入知识页 |
| `LLM Gateway` | 可选 HTTP | 生成智能任务 |
| `omo` | 可选 subprocess | 任务注册到 OMO 治理 |

---

*版本: 0.1.0 · 更新: 2026-07-08*
