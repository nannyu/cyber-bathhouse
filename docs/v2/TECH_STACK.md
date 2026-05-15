# 技术方案

## 1. 技术选型

| 模块 | 技术 | 原因 |
|------|------|------|
| 前端框架 | Vanilla JS + Vite | 复用 v1，轻量无框架依赖 |
| 游戏渲染 | HTML5 Canvas 2D | 复用 v1 渲染引擎，像素风适配 |
| 地图渲染 | 自研 TileMap（基于 Tiled JSON 格式） | 灵活控制，无额外依赖 |
| 实时通信 | Socket.IO | 复用 v1，成熟稳定 |
| 后端框架 | Express.js | 复用 v1 |
| 数据库 | SQLite (better-sqlite3) | 复用 v1，单文件部署简单 |
| Agent 协议 | CBAP (HTTP Webhook + WebSocket) | 自定义协议，灵活 |
| 部署 | Docker + Nginx | 复用 v1 |

### 为什么不用 Phaser / Colyseus / PostgreSQL / Redis？

新计划文档建议了这些技术，但考虑到：

1. **Phaser**：当前 Canvas 引擎已能满足像素渲染需求，引入 Phaser 会增加包体积和学习成本
2. **Colyseus**：房间状态同步可以用现有 Socket.IO + 自研 RoomManager 实现，避免引入重框架
3. **PostgreSQL**：MVP 阶段 SQLite 足够，部署更简单；后续用户量大时再迁移
4. **Redis**：临时状态直接放内存（Map），MVP 不需要分布式缓存

**原则：MVP 用最少依赖验证核心玩法，后续按需升级。**

---

## 2. 目录结构规划

```
Cyber-Bathhouse/
├── server/
│   ├── index.js              # 服务入口（复用）
│   ├── config.js             # 配置（重写）
│   ├── api/
│   │   ├── auth.js           # 认证（复用）
│   │   ├── routes.js         # REST 路由（改造）
│   │   └── websocket.js      # WebSocket 事件（改造）
│   ├── db/
│   │   └── Database.js       # 数据库（扩展新表）
│   ├── game/                 # 🆕 游戏核心逻辑
│   │   ├── RoomManager.js    # 房间管理
│   │   ├── GameLoop.js       # 游戏主循环（Tick）
│   │   ├── ActionValidator.js # 动作校验
│   │   ├── DayCycle.js       # 日夜循环
│   │   ├── TileMap.js        # 地图数据
│   │   ├── Entity.js         # 实体基类
│   │   ├── Player.js         # 玩家角色
│   │   ├── Facility.js       # 设施（锅炉/浴池/货架）
│   │   ├── Customer.js       # 顾客 NPC
│   │   ├── Resource.js       # 资源系统
│   │   ├── Inventory.js      # 背包/库存
│   │   ├── TaskManager.js    # 任务系统
│   │   ├── EventSystem.js    # 事件系统
│   │   ├── TrustSystem.js    # 信任系统
│   │   └── ContractSystem.js # 合约系统
│   ├── agent/                # 🆕 Agent 接入
│   │   ├── AgentTick.js      # Tick 状态推送
│   │   ├── AgentGateway.js   # Webhook/WS 网关
│   │   └── AgentLogger.js    # 行为日志
│   └── combat/               # 保留但不加载（未来可能回归）
│       └── ...
│
├── client/
│   ├── index.html            # 入口（改造 UI）
│   ├── vite.config.js        # 构建配置（复用）
│   └── src/
│       ├── main.js           # 前端入口（改造）
│       ├── styles/
│       │   └── index.css     # 样式（改造）
│       ├── net/
│       │   └── Connection.js # Socket 客户端（改造事件名）
│       └── engine/
│           ├── Game.js       # 游戏主循环（改造）
│           ├── TileMapRenderer.js  # 🆕 Tile 地图渲染
│           ├── EntityRenderer.js   # 🆕 实体渲染（角色/NPC/设施）
│           ├── UILayer.js          # 🆕 UI 层（背包/任务/资源）
│           ├── SpriteRenderer.js   # 像素角色绘制（复用+扩展）
│           └── Camera.js           # 🆕 摄像机（地图滚动）
│
├── shared/                   # 共享常量/类型
│   ├── actions.js            # 🆕 动作类型定义
│   ├── resources.js          # 🆕 资源类型定义
│   └── events.js             # 🆕 事件类型定义
│
├── maps/                     # 🆕 地图数据
│   └── bathhouse_main.json   # Tiled 导出的 JSON 地图
│
├── docs/v2/                  # v2 文档
└── ...
```

---

## 3. 依赖清单

### 保留（来自 v1）

```json
{
  "express": "^4.21.0",
  "socket.io": "^4.8.0",
  "better-sqlite3": "^12.9.0",
  "bcryptjs": "^3.0.3",
  "uuid": "^10.0.0",
  "cors": "^2.8.5",
  "zod": "^3.24.0"
}
```

### 可能新增

```json
{
  "pathfinding": "^0.4.18"  // A* 寻路（角色自动导航到目标）
}
```

### 开发依赖（保留）

```json
{
  "vite": "^6.0.0",
  "concurrently": "^9.1.0",
  "socket.io-client": "^4.8.0"
}
```

---

## 4. Tick 频率设计

| 系统 | 频率 | 说明 |
|------|------|------|
| GameLoop | 10 Hz (100ms) | 世界状态更新 |
| 状态广播 | 5 Hz (200ms) | 客户端同步（每 2 个 GameTick 广播一次） |
| Agent Tick | 0.5 Hz (2000ms) | Agent 感知推送（每 20 个 GameTick） |
| 日循环 | 可配置 | 默认 1 游戏日 = 5 分钟真实时间 |

---

## 5. 数据库 Schema 扩展

### 新增表

```sql
-- 房间
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mode TEXT DEFAULT 'coop',
  map_id TEXT DEFAULT 'bathhouse_main',
  max_players INTEGER DEFAULT 4,
  max_agents INTEGER DEFAULT 4,
  state_json TEXT,
  day INTEGER DEFAULT 1,
  created_at INTEGER
);

-- 角色（房间内）
CREATE TABLE room_characters (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'player' | 'agent'
  x INTEGER DEFAULT 0,
  y INTEGER DEFAULT 0,
  energy INTEGER DEFAULT 100,
  money INTEGER DEFAULT 0,
  inventory_json TEXT DEFAULT '[]',
  trust INTEGER DEFAULT 50,
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

-- 设施
CREATE TABLE facilities (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'boiler' | 'bath' | 'shelf' | ...
  x INTEGER,
  y INTEGER,
  state_json TEXT,
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

-- 行动日志
CREATE TABLE action_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  tick INTEGER,
  action_json TEXT,
  result_json TEXT,
  created_at INTEGER
);

-- 任务
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  priority TEXT DEFAULT 'normal',
  assigned_to TEXT,
  status TEXT DEFAULT 'pending',
  reward_json TEXT,
  created_at INTEGER
);

-- 事件记录
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  title TEXT,
  choice_made TEXT,
  effect_json TEXT,
  tick INTEGER,
  created_at INTEGER
);

-- 日结算报告
CREATE TABLE day_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  income INTEGER DEFAULT 0,
  customers_served INTEGER DEFAULT 0,
  avg_satisfaction INTEGER DEFAULT 0,
  incidents INTEGER DEFAULT 0,
  report_json TEXT,
  created_at INTEGER
);

-- 房间状态快照
CREATE TABLE room_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  day INTEGER,
  state_json TEXT NOT NULL,
  created_at INTEGER
);
```
