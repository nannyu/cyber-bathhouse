# Implementation Plan:

## Overview

Phase 0 技术原型实现计划，共 16 个任务，按依赖关系分层执行。预计总工期 9 天。

## Tasks

- [ ] 1. Create v2 game configuration and map data
  - Create `server/game/config-v2.js` with all game constants (tick rate, boiler params, energy costs, map dimensions)
  - Create `maps/bathhouse_phase0.json` with 20×13 tile grid (ground, objects, collision layers, facility positions, spawn points)
  - Create `shared/actions-v2.js` with action type constants and validation schemas (move_to, interact, wait)
  - Requirements: Req 1, Req 3, Req 4

- [ ] 2. Implement TileMap and Pathfinder modules
  - Create `server/game/TileMap.js` — load map JSON, expose collision grid, adjacency queries, isWalkable(x,y), getNeighbors(x,y)
  - Create `server/game/Pathfinder.js` — A* algorithm with Manhattan heuristic, 4-directional movement, returns path array or null
  - Write unit test: verify pathfinding finds shortest path around walls, returns null for unreachable targets
  - Requirements: Req 2, Req 6
  - Depends on: Task 1

- [ ] 3. Implement Character and Facility entities
  - Create `server/game/Character.js` — position, energy, path queue, action queue, state machine (idle/moving/interacting), advance() method
  - Create `server/game/Facility.js` — boiler state (temperature/fuel/condition/status), tick() update method, repair() method, state machine (normal/overheating/broken)
  - Write unit test: verify boiler temperature rises per tick, overheats at threshold, repair reduces temperature
  - Requirements: Req 2, Req 3
  - Depends on: Task 1

- [ ] 4. Implement ActionValidator
  - Create `server/game/ActionValidator.js` — validate move_to (target walkable, path exists), validate interact (adjacent to target, correct intent), validate energy cost
  - Ensure same validation logic applies to both player and agent actions
  - Return structured result: { valid: boolean, rejected: [], validated: [] }
  - Write unit test: verify rejection of moves to walls, interactions from non-adjacent tiles, actions with insufficient energy
  - Requirements: Req 2, Req 6
  - Depends on: Task 2, Task 3

- [ ] 5. Implement TaskManager
  - Create `server/game/TaskManager.js` — auto-generate repair task when boiler overheats, track task status (pending/completed), mark complete when boiler temp drops below threshold
  - Expose active tasks in room state for perception payloads
  - Write unit test: verify task creation on overheat, completion on repair
  - Requirements: Req 8
  - Depends on: Task 3

- [ ] 6. Implement Room and GameLoop
  - Create `server/game/Room.js` — container for map, characters, facilities, tasks; methods: addCharacter, removeCharacter, getState, getPerception(characterId)
  - Create `server/game/GameLoop.js` — 10Hz setInterval, tick order: processActions → advanceMovement → updateFacilities → checkTasks → broadcast → agentTick
  - Implement tick counter, action queue processing, and facility state updates per tick
  - Write unit test: verify tick executes at correct order, boiler state updates, character movement advances
  - Requirements: Req 4, Req 10
  - Depends on: Task 2, Task 3, Task 4, Task 5

- [ ] 7. Implement AgentTick webhook push
  - Create `server/game/AgentTick.js` — build perception payload (position, energy, visible entities within 5 tiles, active tasks, available actions)
  - Implement HTTP POST to agent endpoint with HMAC signature header (X-CBAP-Signature)
  - Handle timeout (1500ms) → treat as wait action; handle unreachable → log error, treat as wait
  - Parse response: validate JSON, extract actions array (max 2) and reason field; queue validated actions
  - Requirements: Req 5, Req 6
  - Depends on: Task 4, Task 6

- [ ] 8. Implement Action Logging
  - Create `server/game/ActionLogger.js` — persist action log entries to SQLite (action_logs_v2 table)
  - Add database migration: CREATE TABLE action_logs_v2
  - Log both player and agent actions (agent includes reason field)
  - Create REST endpoint `GET /api/v2/action-log?room_id=X&limit=N` to query logs
  - Requirements: Req 9
  - Depends on: Task 6

- [ ] 9. Implement WebSocket v2 event handling
  - Create `server/api/websocket-v2.js` — handle 'action' events from clients (move_to, interact), validate and queue
  - Implement state broadcast every 2 ticks (5Hz) with characters, facilities, tasks
  - Implement 'room:join' event — add player character to room, send initial state + map data
  - Implement 'action:rejected' event — notify client of invalid actions
  - Requirements: Req 2, Req 10
  - Depends on: Task 4, Task 6

- [ ] 10. Integrate GameLoop with Express server
  - Create `server/game/index.js` — initialize Room, GameLoop, AgentTick; export for use in server/index.js
  - Modify `server/index.js` to mount v2 game module (config flag to switch v1/v2)
  - Add REST routes: `POST /api/v2/room/create`, `POST /api/v2/agent/register`, `GET /api/v2/action-log`
  - Wire WebSocket v2 events to GameLoop action queue
  - Requirements: Req 4, Req 5, Req 9
  - Depends on: Task 6, Task 7, Task 8, Task 9

- [ ] 11. Implement client TileMapRenderer
  - Create `client/src/engine/TileMapRenderer.js` — render ground layer (color-coded tiles), render objects layer (walls, doors), render collision overlay (debug mode)
  - Load map data from server on room join
  - Render 20×13 grid at 32×32px per tile (640×416 viewport)
  - Requirements: Req 1
  - Depends on: Task 1

- [ ] 12. Implement client EntityRenderer
  - Create `client/src/engine/EntityRenderer.js` — render player character (colored square + name tag), render agent character (different color + 🤖 icon), render boiler facility (color changes with temperature)
  - Implement smooth interpolation between grid positions for character movement
  - Show interaction indicator (pulsing circle) when character is interacting
  - Requirements: Req 7
  - Depends on: Task 11

- [ ] 13. Implement client InputHandler and GameV2 loop
  - Create `client/src/engine/InputHandler.js` — canvas click → grid coordinate conversion, emit move_to/interact intents
  - Create `client/src/engine/GameV2.js` — requestAnimationFrame loop, receive state updates via WebSocket, call TileMapRenderer + EntityRenderer each frame
  - Implement click-on-facility detection for interact actions
  - Requirements: Req 2, Req 7, Req 10
  - Depends on: Task 11, Task 12

- [ ] 14. Create client v2 entry page
  - Create `client/v2.html` — minimal HTML with canvas element and connection UI
  - Create `client/src/main-v2.js` — connect WebSocket, join room, initialize GameV2
  - Add Vite config entry for v2 page
  - Display resource bar (boiler temp, fuel) and task list overlay on canvas
  - Requirements: Req 1, Req 10
  - Depends on: Task 13

- [ ] 15. Create test Agent script
  - Create `scripts/test-agent-v2.js` — HTTP server that receives CBAP perception POSTs
  - Implement simple rule-based logic: if boiler overheating → move_to boiler → interact repair
  - Return actions with reason field explaining decision
  - Add instructions in README for running the test agent
  - Requirements: Req 8
  - Depends on: Task 7

- [ ] 16. End-to-end smoke test
  - Create `scripts/phase0-smoke-test.js` — programmatic test without browser
  - Verify: room creation, character addition, 200 ticks simulation, boiler overheats, mock agent receives perception, agent action moves character, repair reduces temperature, action log has entries
  - Add `npm run test:phase0` script to package.json
  - Verify all 10 requirements' acceptance criteria pass
  - Requirements: Req 1-10
  - Depends on: Task 10, Task 15

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": [1]},
    {"tasks": [2, 3, 11]},
    {"tasks": [4, 5, 12]},
    {"tasks": [6, 13]},
    {"tasks": [7, 8, 9, 14]},
    {"tasks": [10, 15]},
    {"tasks": [16]}
  ]
}
```

## Notes

- Tasks 1-6 are server-side foundation (can be developed without browser)
- Tasks 11-14 are client-side (can be developed in parallel with server tasks 7-10)
- Task 15 (test agent) can start once Task 7 is done
- Task 16 (E2E test) is the final validation gate
- Estimated critical path: Task 1 → 2 → 4 → 6 → 7 → 10 → 16 (约 7 天)
- Client tasks (11-14) run in parallel, adding ~2 天 if sequential
