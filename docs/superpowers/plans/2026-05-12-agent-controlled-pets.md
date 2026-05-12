# Agent 接管宠物 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户一键绑定外部 Agent 接管宠物，并让绑定 Agent 以宠物身份心跳、移动、公开说话、做动作和回到主人身边。

**Architecture:** 在现有宠物档案、Agent 邀请、私聊与世界状态基础上扩展。宠物仍挂在 `User.pet` 上，但新增独立控制模式、目标坐标、气泡和 Agent 心跳元数据；REST 先提供完整宠物控制闭环，MCP 文档与邀请命令先落在现有入口兼容层，后续可再独立拆 `/mcp/pet`。

**Tech Stack:** Node.js 20、Express、Socket.IO、better-sqlite3、Vite、原生脚本冒烟测试。

---

## 文件结构

- 修改 `server/db/Database.js`：新增迁移字段、宠物设置更新、绑定状态、Agent token 撤销和心跳持久化。
- 修改 `server/world/Pet.js`：新增独立控制模式、目标移动、宠物气泡和序列化字段。
- 修改 `server/world/User.js`：创建宠物时注入档案元数据。
- 修改 `server/world/World.js`：新增 Agent 宠物状态、观察、移动、说话、动作、回归、心跳方法。
- 修改 `server/api/routes.js`：扩展宠物设置、邀请返回命令，新增主人召回/断开和 Agent 宠物 REST 路由。
- 修改 `client/src/net/Connection.js`：新增设置、召回、断开、Agent 邀请字段调用。
- 修改 `client/src/main.js`：宠物设置面板增加控制模式、心跳、公开发言、状态、召回和断开。
- 新增 `scripts/agent-pet-smoke-test.js`：覆盖绑定 Agent 控制宠物的核心行为。
- 修改 `package.json`：增加 `test:agent-pet`。
- 修改文档 `AGENTS.md`、`docs/API_REFERENCE.md`、`docs/MCP_GUIDE.md`：补充 Agent 宠物连接与心跳。

## Task 1: 后端核心与冒烟测试

**Files:**
- Create: `scripts/agent-pet-smoke-test.js`
- Modify: `package.json`
- Modify: `server/db/Database.js`
- Modify: `server/world/Pet.js`
- Modify: `server/world/User.js`
- Modify: `server/world/World.js`
- Modify: `server/api/routes.js`

- [ ] **Step 1: 写失败测试**

创建 `scripts/agent-pet-smoke-test.js`，测试以下行为：数据库迁移有默认宠物控制字段；主人开启 `agent_controlled`；绑定 Agent 可以心跳、移动、公开说话；关闭公开发言后说话失败；召回后移动失败；撤销 token 后心跳失败。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent-pet`

Expected: 因为脚本或生产方法尚不存在而失败。

- [ ] **Step 3: 实现最小后端能力**

实现数据库字段、运行时宠物状态、`World.processAgentPet*` 方法和 REST 路由。保持宠物不是完整用户，不接入金币、下注或格斗。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:agent-pet`

Expected: 输出 `{"ok":true,...}`。

## Task 2: 前端连接与设置面板

**Files:**
- Modify: `client/src/net/Connection.js`
- Modify: `client/src/main.js`

- [ ] **Step 1: 扩展前端 API 封装**

新增更新宠物完整设置、召回宠物、断开 Agent、读取邀请命令的调用。

- [ ] **Step 2: 更新宠物设置 UI**

显示连接状态、控制模式、定期活跃、活跃频率、公开发言、召回和断开按钮。生成邀请后展示 Codex/Claude/Kimi 命令。

- [ ] **Step 3: 构建验证**

Run: `npm run build:client`

Expected: Vite build 成功。

## Task 3: MCP 与文档

**Files:**
- Modify: `server/mcp/index.js`
- Modify: `AGENTS.md`
- Modify: `docs/API_REFERENCE.md`
- Modify: `docs/MCP_GUIDE.md`

- [ ] **Step 1: 增加宠物 MCP 工具**

在现有 MCP 入口中为绑定普通 Agent 会话增加宠物工具：`bathhouse_pet_status`、`bathhouse_pet_look`、`bathhouse_pet_move`、`bathhouse_pet_say`、`bathhouse_pet_emote`、`bathhouse_pet_return`、`bathhouse_pet_heartbeat`。

- [ ] **Step 2: 更新文档**

说明一键连接命令、REST Agent 宠物接口、心跳协议和权限开关。

- [ ] **Step 3: 全量验证**

Run: `npm run test:agent-pet && npm run test:economy && npm run test:combat && npm run build:client`

Expected: 全部通过。
