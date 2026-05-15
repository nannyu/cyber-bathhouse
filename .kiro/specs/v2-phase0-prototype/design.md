# Technical Design

## Overview

Phase 0 技术原型的服务器权威架构实现。服务端运行 10Hz GameLoop，管理 Tile 地图、角色移动、设施状态和 Agent 通信。客户端渲染 Tile 地图和实体，通过 WebSocket 发送意图。Agent 通过 CBAP HTTP Webhook 接收感知、返回动作。

## Components and Interfaces

## Architecture

### Server Components

```
server/game/
├── GameLoop.js         # 10Hz 固定频率主循环
├── Room.js             # 房间状态容器（地图+角色+设施+任务）
├── TileMap.js          # 地图数据加载、碰撞检测、邻接查询
├── Pathfinder.js       # A* 寻路算法
├── Character.js        # 角色实体（位置/路径/能量/动作队列）
├── Facility.js         # 设施实体（锅炉状态机）
├── ActionValidator.js  # 动作合法性校验
├── TaskManager.js      # 任务生成与状态追踪
├── AgentTick.js        # CBAP Webhook 推送与响应处理
├── ActionLogger.js     # 行动日志持久化
└── config-v2.js        # 游戏配置常量
```

### Client Components

```
client/src/engine/
├── GameV2.js           # v2 游戏主循环
├── TileMapRenderer.js  # Tile 地图 Canvas 渲染
├── EntityRenderer.js   # 角色/设施精灵渲染
├── InputHandler.js     # 点击→网格坐标转换
└── UILayer.js          # 资源/任务 HUD 覆盖层
```

### Interfaces

**GameLoop → Room:**
- `room.processActions(tick)` — 执行所有角色的排队动作
- `room.advanceMovement()` — 推进角色沿路径移动
- `room.updateFacilities()` — 更新设施状态
- `room.getState()` — 获取完整状态快照用于广播
- `room.getPerception(characterId)` — 获取指定角色的感知数据

**ActionValidator → TileMap + Pathfinder:**
- `tileMap.isWalkable(x, y)` → boolean
- `tileMap.isAdjacent(x1, y1, x2, y2)` → boolean
- `pathfinder.findPath(map, sx, sy, ex, ey)` → [{x,y}] | null

**AgentTick → Room + ActionValidator:**
- `room.getPerception(agentId)` → perception payload
- `actionValidator.validate(actions, character, room)` → { validated, rejected }

**WebSocket Events (Client ↔ Server):**

| Direction | Event | Payload |
|-----------|-------|---------|
| C→S | `action` | `{ type: 'move_to', x, y }` or `{ type: 'interact', targetId, intent }` |
| S→C | `state:update` | `{ tick, characters, facilities, tasks }` |
| S→C | `action:rejected` | `{ reason }` |
| S→C | `room:joined` | `{ roomId, map, initialState }` |

**CBAP Webhook (Server → Agent):**

Request: `POST <agent_endpoint>` with perception JSON + `X-CBAP-Signature` header
Response: `{ actions: [{type, ...params}], reason: string }`

### Data Models

## Data Models

**Character:**
```javascript
{ id, type, name, x, y, energy, path: [{x,y}], actionQueue: [], state: 'idle'|'moving'|'interacting' }
```

**Facility (Boiler):**
```javascript
{ id, type: 'boiler', x, y, state: { temperature, fuel, condition, status: 'normal'|'overheating'|'broken' } }
```

**Task:**
```javascript
{ id, title, priority, location: {x,y}, requiredAction, targetId, status: 'pending'|'completed', createdAtTick }
```

**ActionLog (SQLite):**
```sql
CREATE TABLE action_logs_v2 (id INTEGER PRIMARY KEY, room_id TEXT, tick INTEGER, actor_id TEXT, actor_type TEXT, actions_submitted TEXT, actions_validated TEXT, actions_rejected TEXT, reason TEXT, world_effect TEXT, created_at INTEGER);
```

### Key Algorithms

**A* Pathfinding:** Manhattan heuristic, 4-directional, uniform cost, collision grid constraint.

**GameLoop Tick Order:**
1. processActions → 2. advanceMovement → 3. updateFacilities → 4. checkTasks → 5. broadcast (every 2 ticks) → 6. agentTick (every 20 ticks) → 7. tick++

**Boiler State Machine:** normal → (temp≥95) → overheating → (repair) → normal; overheating → (temp≥100) → broken

### Configuration

```javascript
{ TICK_RATE: 10, BROADCAST_INTERVAL: 2, AGENT_TICK_INTERVAL: 20, AGENT_TIMEOUT_MS: 1500, MAX_ACTIONS_PER_TICK: 2, MAP_WIDTH: 20, MAP_HEIGHT: 13, TILE_SIZE: 32, BOILER: { TEMP_RISE: 0.15, FUEL_CONSUME: 0.05, REPAIR_REDUCTION: 30, OVERHEAT: 95 } }
```

## Error Handling

| Scenario | Handling |
|----------|----------|
| Agent endpoint unreachable | Treat as `wait`, log error, continue game loop |
| Agent response timeout (>1500ms) | Treat as `wait`, log timeout |
| Agent returns invalid JSON | Reject all actions, log parse error |
| Agent returns >2 actions | Only execute first 2, log warning |
| Player clicks impassable tile | Reject move, send `action:rejected` event |
| Pathfinder finds no path | Reject move, character stays in place |
| GameLoop tick exceeds 100ms | Log warning, proceed without skipping |
| Character has insufficient energy | Reject action, send rejection reason |

## Testing Strategy

### Unit Tests
- Pathfinder: shortest path, wall avoidance, unreachable returns null
- Boiler: temperature rise, overheat detection, repair reduction
- ActionValidator: reject wall moves, reject non-adjacent interact, energy check
- TaskManager: task creation on overheat, completion on repair

### Integration Test (scripts/phase0-smoke-test.js)
- Create room → add characters → simulate 200 ticks → verify boiler overheats → mock agent perception → verify agent action execution → verify action log

### Manual E2E Test
- Browser: see map, click to move, observe agent character, see boiler state change
- Test agent script: receives perception, returns repair actions, boiler temperature drops

## Correctness Properties

### Property 1: Server Authority
No client can modify game state directly; all changes go through ActionValidator.

### Property 2: Deterministic Ticks
Same action queue + same state → same next state (no randomness in core loop).

### Property 3: Fair Treatment
Agent actions validated with identical rules as player actions.

### Property 4: Bounded Latency
Agent has 1500ms to respond; game never blocks waiting for agent.

### Property 5: State Consistency
All clients receive same state broadcast; no client has stale data beyond 200ms.

### Property 6: Energy Conservation
Energy only changes through defined actions and regen; never goes below 0 or above max.
