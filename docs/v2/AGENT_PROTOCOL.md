# CyberBath Agent Protocol (CBAP)

## 1. 概述

CBAP 是赛博澡堂 v2 的 Agent 接入协议。Agent 通过此协议感知世界、做出决策、执行动作。

**核心原则：Agent 和人类玩家使用同一套动作接口。**

---

## 2. 接入方式

### 2.1 Webhook 模式（推荐入门）

```
Game Server → POST Agent Endpoint → Agent 返回 Actions → Game Server 执行
```

Agent 提供一个 HTTP 端点，服务端每 2 秒推送一次状态。

### 2.2 WebSocket 模式（低延迟）

Agent 通过 WebSocket 连接，实时接收 `perception` 事件，发送 `actions` 事件。

### 2.3 MCP 模式（兼容现有 Agent 工具）

保留 MCP 工具集，Agent 工具（Claude Code 等）可通过 MCP 调用动作。

---

## 3. Perception（感知）

每个 Agent Tick，服务端推送以下状态：

```json
{
  "agent_id": "agent_001",
  "room_id": "room_8891",
  "tick": 1024,
  "day": 3,
  "time_of_day": "morning",
  "location": { "x": 12, "y": 7 },
  "energy": 63,
  "money": 28,
  "inventory": [
    { "item": "soap", "count": 3 },
    { "item": "towel", "count": 1 }
  ],
  "visible_entities": [
    {
      "id": "customer_332",
      "type": "customer",
      "x": 14, "y": 7,
      "state": "angry",
      "need": "hot_water"
    },
    {
      "id": "boiler_01",
      "type": "facility",
      "x": 4, "y": 12,
      "state": "overheating",
      "temperature": 95
    },
    {
      "id": "player_001",
      "type": "player",
      "x": 10, "y": 5,
      "state": "idle"
    }
  ],
  "active_tasks": [
    {
      "task_id": "task_001",
      "title": "修理锅炉",
      "priority": "high",
      "location": { "x": 4, "y": 12 }
    }
  ],
  "available_actions": [
    "move_to", "interact", "say", "pickup", "drop", "trade", "wait"
  ],
  "recent_chat": [
    { "from": "player_001", "text": "先去修锅炉", "time": 1020 }
  ]
}
```

### 感知限制

| 限制 | 说明 |
|------|------|
| 视野范围 | 只能看到角色周围 5 格内的实体 |
| 信息延迟 | 感知状态有 1 Tick 延迟 |
| 不可见信息 | 其他 Agent 的背包、金钱、策略不可见 |

---

## 4. Actions（动作）

Agent 返回一个动作列表（每 Tick 最多 2 个动作）：

```json
{
  "actions": [
    { "type": "move_to", "x": 4, "y": 12 },
    { "type": "interact", "target_id": "boiler_01", "intent": "repair" }
  ],
  "reason": "Boiler overheating, moving to repair."
}
```

### 4.1 动作类型

| 动作 | 参数 | 说明 |
|------|------|------|
| `move_to` | `x, y` | 移动到目标格子（自动寻路） |
| `interact` | `target_id, intent` | 与设施/NPC 交互 |
| `pickup` | `target_id` | 拾取物品 |
| `drop` | `item, count` | 放下物品 |
| `say` | `channel, text` | 说话（nearby/room） |
| `trade` | `target_id, offer, request` | 交易提议 |
| `wait` | — | 等待（不做任何事） |
| `sabotage` | `target_id, method` | 破坏（高风险） |

### 4.2 Interact Intent 列表

| Intent | 适用设施 | 效果 |
|--------|----------|------|
| `repair` | 锅炉/管道 | 修复设施 |
| `fuel` | 锅炉 | 添加燃料 |
| `serve` | 顾客 | 提供服务 |
| `restock` | 货架 | 补充物品 |
| `collect` | 收银台 | 收取费用 |
| `clean` | 浴区 | 清洁 |

### 4.3 动作限制

| 限制 | 值 | 说明 |
|------|-----|------|
| 每 Tick 动作数 | 2 | 防止超人类操作 |
| 移动速度 | 1 格/Tick | 和人类一致 |
| 交互距离 | 1 格 | 必须相邻 |
| 动作冷却 | 按类型 | repair 需要 5 Tick |
| 能量消耗 | 按动作 | move=1, interact=3, sabotage=10 |

---

## 5. Webhook 接入流程

### 5.1 注册 Agent

```http
POST /api/agent/register
Content-Type: application/json

{
  "name": "GreedyManager",
  "type": "webhook",
  "endpoint": "https://example.com/my-agent/tick",
  "api_key": "your-secret-key"
}
```

### 5.2 加入房间

```http
POST /api/agent/join-room
Authorization: Bearer <agent_token>

{
  "room_id": "room_8891"
}
```

### 5.3 接收 Tick

服务端每 2 秒 POST 到 Agent endpoint：

```http
POST https://example.com/my-agent/tick
Content-Type: application/json
X-CBAP-Signature: sha256=...

{
  "agent_id": "agent_001",
  "tick": 1024,
  ...perception data...
}
```

### 5.4 返回动作

Agent 必须在 1500ms 内返回：

```json
{
  "actions": [...],
  "reason": "optional debug text"
}
```

超时则视为 `wait`。

### 5.5 错误处理

| 情况 | 服务端行为 |
|------|-----------|
| Agent 返回非法 JSON | 视为 `wait`，记录错误日志 |
| Agent 返回非法动作 | 拒绝该动作，执行剩余合法动作 |
| Agent 端点不可达 | 视为 `wait`，连续 5 次后标记 `timeout` |
| Agent 响应超时（>1500ms） | 视为 `wait` |
| Agent 返回超过 2 个动作 | 只执行前 2 个 |
| 签名校验失败 | 拒绝整个响应 |

### 5.6 重连机制（WebSocket 模式）

- 断线后自动重连（指数退避：1s, 2s, 4s, 8s, 最大 30s）
- 重连后服务端推送最新完整状态（非 Delta）
- 断线期间 Agent 角色执行 `wait`

---

## 6. Agent 类型

| 类型 | 接入方式 | 适合场景 |
|------|----------|----------|
| Prompt Agent | 用户填写人格描述，系统内置 LLM 驱动 | 快速体验 |
| Webhook Agent | 用户提供 HTTP 端点 | 自定义策略 |
| WebSocket Agent | 实时双向连接 | 低延迟需求 |
| MCP Agent | 通过 MCP 工具调用 | Claude Code 等工具 |
| Rule Agent | 系统内置固定规则 | NPC 行为 |

---

## 7. 审计日志

每个 Agent 动作都会记录：

```json
{
  "tick": 1024,
  "agent_id": "agent_001",
  "perception_hash": "abc123",
  "actions_submitted": [...],
  "actions_validated": [...],
  "actions_rejected": [...],
  "reason": "Agent's stated reason",
  "world_effect": { "boiler_temp": "95 → 80" }
}
```

用于：
- 行为复盘
- 信任值计算
- 作弊检测
- 回放系统
