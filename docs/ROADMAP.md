---
type: ssot
owner: governance-team
last_updated: 2026-09-03
---

# Family Hub Gamification Roadmap & Spec

## 1. 💡 创意与分析 (Ideation & PM Phase)

**核心痛点**：传统家庭任务（做家务、写作业、阅读）缺乏正向激励，儿童缺乏主动参与的内驱力。家庭日程管理枯燥。
**本质目的**：将 Family Hub 转化为一个“微型家庭 MMORPG”，赋予家庭成员身份（Profiles）、属性成长（Wisdom, Responsibility）、任务系统（Quests）和经济系统（Inventory/Rewards）。让 eCOS v6 OS 具备真实生活场景的交互触角。

**三个维度的创意发散：**
1. **常规版（微习惯引擎）**：提供类似 Habitica 的基础面板，发布任务 -> 孩子点击完成 -> 父母审核发放金币/经验 -> 经验升级。
2. **进阶版（结合 Kairon 知识库智能推荐）**：基于 Kairon 引擎，根据孩子当前的知识盲区（由父母配置）自动生成科普阅读任务。完成家务获取的奖励，可以用来解锁 Hermes Console 上的“娱乐时间（网络通行证）”。
3. **疯狂版（A2A 物理网关互联）**：将 Agora Mesh 连接至家里的智能音箱/IoT 设备。当完成特定感官任务（如早起），物理世界灯光变绿，系统内部广播 "Achievement Unlocked"，并且自动将成就记录到 L0 链上，形成不可篡改的“童年区块链数字档案”。

> 我们将采用 **核心取 常规版 + 智能推荐 (进阶版)** 的 MVP 路径，保证敏捷落地。

---

## 2. 🗺️ 规划与设计 (Roadmap)

### MVP 阶段 (v0.1) - 基础闭环
- [x] **数据模型**：设计 SQLite 数据库结构（Profiles, Quests, Inventory, Transactions）。*(目前基础 SQLite Schema 已存在)*
- [ ] **FastMCP 服务重构**：将现有的 stdin/stdout POC 脚本 (`mcp_server.py`) 升级为基于标准 `FastMCP` (或 FastAPI) 的服务，纳入 `bos://persona/family` 域。
- [ ] **React 前端界面重塑**：
  - 设计符合儿童审美（大字号、高饱和度色彩、微动效）的 UI 界面。
  - **角色面板 (Profile View)**：显示等级、经验槽、智慧点数/责任点数。
  - **任务看板 (Quest Board)**：日常任务、周任务、挑战任务分类。
  - **兑换所 (Inventory/Shop)**：用点数兑换现实奖励（如：周六去游乐园凭证、多看一集动画片）。

### V1.0 阶段 -智能化与全栈集成
- [ ] **A2A (Agent-to-Agent) 互动**：接入 `l4-kernel`，当家庭成员完成重大任务时，由 Agent 自动撰写“每周家庭报纸（英雄事迹）”。
- [ ] **移动端自适应**：Family Hub 前端 100% 响应式，支持在 iPad 或手机端作为 PWA 安装。

---

## 3. 📝 用户故事 (User Story)

1. **作为儿童用户 (As a Child)**：
   - *I want to* 每天看到一个带有进度条的动态头像和我的经验值。
   - *so that* 我能直观感受到自己做家务和学习带来的“升级”快感。
2. **作为父母用户 (As a Parent)**：
   - *I want to* 在后台快速发布带有具体“责任点数 (Responsibility Points)”的任务。
   - *so that* 我不需要反复催促孩子去执行日常琐事。
3. **作为系统 Agent (As an L4 Observer)**：
   - *I want to* 订阅 `family-hub` 的完成信号。
   - *so that* 可以在每周日自动汇总全家人的进步，生成家庭周报。

---

## 4. ✅ 任务清单 (Action Items / GitHub Issue)

- [ ] **Phase 1: Backend Upgrade (FastMCP/FastAPI Integration)**
  - 弃用现有的 stdin/stdout 脚本，引入 `mcp.server.fastmcp` 或 `FastAPI`，在 `projects/family-hub` 中暴露标准的 REST/JSON-RPC 接口（支持 `get_profiles`, `get_quests`, `complete_quest`）。
  - 更新 Agora registry 注册。
- [ ] **Phase 2: UI Foundation & Gamification Theming**
  - 使用 TailwindCSS (如果允许) 或 Vanilla CSS，设计一套活泼的 UI 调色板和玻璃拟物化设计。
  - 实现 Profile 卡片组件（带等级环、经验条动画）。
- [ ] **Phase 3: Quest Board & Interaction**
  - 实现任务列表的展现、分类。
  - 实现点击完成任务时的炫酷微动效（粒子爆发或金币掉落声）。
- [ ] **Phase 4: Store & Inventory System**
  - 兑换真实世界奖励的 Store 页面开发。
