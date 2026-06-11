# AGENTS.md — Family Hub

> eCOS v5 家庭应用 · 家庭设备管理 + 生活服务 + 智能场景

## Quick Commands

```bash
cd projects/family-hub
bun install
bun run dev
bun run build
bun run lint
```

## Architecture

应用层项目，使用 TypeScript + React + Vite 构建：

```
前端:  React + TypeScript + Vite
状态:  React hooks + Context
后端:  依赖 agora BOS URI 获取数据
```

### 功能模块

| 模块 | 职责 |
|:-----|:------|
| 设备管理 | 家庭设备的注册、状态、控制 |
| 生活服务 | 日程、提醒、购物清单 |
| 智能场景 | 自动化规则和场景触发 |

## Dependencies

- Bun runtime, TypeScript, React, Vite

## Testing

当前使用 ESLint 进行静态检查。测试框架待集成。

```bash
bun run lint
bunx tsc --noEmit   # 类型检查
```
