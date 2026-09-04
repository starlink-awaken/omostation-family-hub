---
type: derived
source: projects/family-hub
owner: governance-team
last_updated: 2026-09-03
---

# Family Dashboard App

基于 Next.js 16 的家庭信息面板应用。应用会从仓库外部的家庭 SSOT 目录读取 Markdown/YAML 数据，构建出 `app-data/*.json`，再由前端页面消费。

## 环境要求

- Bun 1.3+
- Node.js 20+
- 可访问的家庭 SSOT 目录

## 首次安装

```bash
bun install
cp .env.example .env.local
```

`.env.local` 至少需要配置：

```bash
NEXT_PUBLIC_APP_NAME=family-dashboard-app
FAMILY_DASHBOARD_PASSWORD=change_me
FAMILY_DASHBOARD_COOKIE_TTL_DAYS=7
```

如果家庭 SSOT 不在应用上一级目录，需要额外指定：

```bash
export FAMILY_DOCUMENTS_ROOT=/absolute/path/to/read-only/family-documents
export FAMILY_DASHBOARD_STATE_ROOT=/absolute/path/to/workspace/runtime/family-hub/dashboard
```

默认情况下，构建脚本会把 `process.cwd()` 的上一级目录视为 SSOT 根目录。

## 本地运行

先构建应用数据：

```bash
bun run build:data
```

再启动开发服务器：

```bash
bun run dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000)。

## 常用命令

```bash
# 构建 app-data/*.json
bun run build:data

# 校验 summary.json
bun run verify:summary

# 校验各领域 JSON
bun run verify:domain-data

# 完整数据校验
bun run verify:data

# 单元测试（Vitest）
bun run test

# ESLint
bun run lint

# 生产构建（含 build:data）
bun run build
```

## 测试范围

当前 Vitest 基础测试覆盖：

- `src/lib/redact.ts`：敏感信息脱敏、空白折叠、截断逻辑
- `src/lib/data-loader.ts`：`app-data` JSON 读取
- `src/lib/manifest.ts`：summary/domain manifest 默认值与 YAML 合并
- `src/lib/ssot.ts`：SSOT 根路径解析与环境变量覆盖

## 数据工作流

修改领域数据或页面配置的标准工作流：

```bash
# 1. 修改 data-manifest/*.yaml（配置页面信息位、空态文案等）
#
# 2. 重新构建 app-data/*.json
bun run build:data
#
# 3. 验证数据完整性（schema 校验 + 敏感信息检查）
bun run verify:data
#
# 4. 启动开发服务器预览
bun run dev
```

## 运行建议

- 修改 `data-manifest/*.yaml` 后，执行 `bun run build:data` 或直接用 `bun run build`（含校验+构建）
- 修改数据构建脚本或 lib 工具后，执行 `bun run test && bun run verify:data`
- 提交前至少执行 `bun run lint && bun run build`
- 新增页面信息位时，确保组件处理空数组状态（参考 `HealthArchives` 的 "暂无XXX数据" 模式）
