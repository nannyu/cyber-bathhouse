# 复用分析 — 从 v1 到 v2

## 概述

v1（实时互动澡堂）有大量基础设施可以直接复用或轻度改造后用于 v2（经营建设游戏）。

---

## ✅ 可直接复用

| 模块 | 文件位置 | 说明 |
|------|----------|------|
| Express 服务框架 | `server/index.js` | HTTP + 静态文件 + 中间件 |
| Socket.IO 实时通信 | `server/api/websocket.js` | 双向事件通信，改事件名即可 |
| 认证系统 | `server/api/auth.js` | 注册/登录/Token/bcrypt |
| SQLite 数据库 | `server/db/Database.js` | 用户表、会话表可复用，新增游戏表 |
| Vite 前端构建 | `client/vite.config.js` | 零改动 |
| Docker 部署 | `Dockerfile`, `docker-compose.yml`, `nginx.conf` | 零改动 |
| 包管理 | `package.json` | 依赖基本不变 |

## 🔄 需要改造复用

| 模块 | 当前用途 | v2 用途 | 改造程度 |
|------|----------|---------|----------|
| `World.js` | 单场景世界状态 | 房间制多地图世界状态 | 重构，保留模式 |
| `User.js` | 角色实体（位置/状态/HP） | 角色实体（位置/背包/能量/任务） | 中度改造 |
| `ChatManager.js` | 聊天消息管理 | 频道聊天（nearby/room/global） | 轻度改造 |
| `SpriteRenderer.js` | 像素角色绘制 | 保留角色绘制，新增设施/NPC 绘制 | 扩展 |
| `Game.js` | 游戏主循环 | 保留循环框架，替换渲染内容 | 中度改造 |
| `Connection.js` | Socket 客户端封装 | 保留封装，改事件名 | 轻度改造 |
| `MCP Server` | Agent 工具集 | 改造为 CBAP 协议端点 | 重构 |
| `config.js` | 世界参数 | 改为房间/地图/资源参数 | 重写 |

## ❌ 不复用（v2 不需要）

| 模块 | 原因 |
|------|------|
| `FightManager.js` | v2 无格斗系统（可能后续加入简化版） |
| `CombatEngine.js` | 帧模拟格斗引擎，v2 不需要 |
| `SkillRegistry.js` | 格斗技能数据 |
| `TacticalDirector.js` | AI 格斗策略 |
| `ReactiveController.js` | 格斗反应控制 |
| `FightMatch.js` | 格斗状态机 |
| `RageSystem.js` | 怒气系统 |
| `EffectsLayer.js` | 格斗特效（可能保留粒子框架） |
| `SkillPoses.js` | 格斗姿态绘制 |
| `Bathhouse.js` | v1 场景渲染（替换为 Tile 地图） |
| `Pet.js` | 宠物系统（v2 暂不需要） |

## 🆕 需要新建

| 模块 | 说明 |
|------|------|
| `TileMap.js` | Tile-based 地图加载与渲染 |
| `Room.js` | 房间状态管理（多房间支持） |
| `Facility.js` | 设施实体（锅炉/浴池/货架等） |
| `Resource.js` | 资源系统（热水/电力/毛巾/金钱） |
| `Inventory.js` | 背包/库存系统 |
| `Customer.js` | 顾客 NPC（需求/满意度/行为） |
| `TaskManager.js` | 任务分配/追踪/结算 |
| `EventSystem.js` | 随机事件触发/选择/效果 |
| `AgentTick.js` | CBAP 协议处理（状态推送/动作接收） |
| `ContractSystem.js` | 合约创建/执行/违约 |
| `TrustSystem.js` | Agent 信任/声望计算 |
| `DayCycle.js` | 日夜循环/每日结算 |
| `MapEditor` | 地图编辑工具（可用 Tiled 导出） |

---

## 复用策略

1. **保留 `server/` 目录结构**，在其中新建 `game/` 子目录放经营逻辑
2. **保留 `client/src/engine/` 结构**，新建 `tilemap/` 和 `ui/` 子目录
3. **保留认证和通信层**，只改业务事件
4. **数据库新增表**，不删除旧表（v1 数据可保留）
5. **格斗系统代码保留但不加载**，未来可能作为"澡堂擂台"小游戏回归
