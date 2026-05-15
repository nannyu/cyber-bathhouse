# Requirements Document

## Introduction

Phase 0 of the Cyber-Bathhouse v2 refactor — a technical prototype to validate the core hypothesis: "An external Agent can control a pixel character like a player and complete a management task." This prototype implements a minimal tile-based game with 1 human player and 1 Webhook Agent co-managing a boiler room facility. The server uses a 10Hz game loop, pushes perception state to the Agent every 2 seconds via HTTP webhook, and the Agent returns actions that are validated and executed identically to player actions.

## Glossary

- **Game_Server**: The Node.js + Express + Socket.IO backend that runs the authoritative game loop, validates actions, manages state, and communicates with clients and agents
- **Web_Client**: The browser-based Vanilla JS + Canvas 2D frontend that renders the tile map, characters, and UI, and sends player intents via WebSocket
- **Webhook_Agent**: An external HTTP endpoint that receives perception state pushes and returns action responses conforming to the CBAP protocol
- **Game_Loop**: The server-side fixed-rate update cycle running at 10Hz (100ms per tick) that advances world state
- **Agent_Tick**: A periodic state push from Game_Server to Webhook_Agent occurring every 20 game ticks (2 seconds real time)
- **Tile_Map**: A 20×13 grid of 32×32 pixel tiles representing the game world, containing a simplified lobby and boiler room
- **Boiler**: A facility entity with temperature, fuel, and condition state that produces hot water and can overheat
- **Action_Validator**: The server module that checks action legality (position reachability, energy cost, interaction distance, cooldowns) before execution
- **Action_Log**: A persistent record of every action submitted, validated, executed, and its world effect, including the agent's stated reasoning
- **Pathfinder**: The A* algorithm module that computes grid movement paths for characters
- **CBAP**: CyberBath Agent Protocol — the HTTP webhook protocol for agent perception and action exchange

## Requirements

### Requirement 1: Tile Map Rendering

**User Story:** As a player, I want to see a tile-based map rendered in my browser, so that I can understand the game world layout and navigate within it.

#### Acceptance Criteria

1. WHEN the Web_Client loads, THE Web_Client SHALL render a 20×13 Tile_Map using Canvas 2D with 32×32 pixel tiles
2. THE Tile_Map SHALL display distinct visual tiles for walls, walkable floor, doors, and facility objects (boiler, control panel, toolbox)
3. THE Tile_Map SHALL include two zones: a simplified lobby area and a boiler room area separated by a wall with a door
4. WHEN a tile is marked as a wall in the collision layer, THE Web_Client SHALL render that tile as impassable and visually distinct from walkable tiles

### Requirement 2: Player Character Movement

**User Story:** As a player, I want to move my character on the tile map by clicking a destination, so that I can navigate to facilities and interact with them.

#### Acceptance Criteria

1. WHEN the player clicks a walkable tile on the Tile_Map, THE Web_Client SHALL send a move_to intent with the target grid coordinates to the Game_Server via WebSocket
2. WHEN the Game_Server receives a valid move_to intent, THE Pathfinder SHALL compute an A* path from the character's current position to the target tile
3. WHILE a character is moving along a computed path, THE Game_Loop SHALL advance the character by 1 tile per game tick along the path
4. IF the player clicks an impassable tile, THEN THE Game_Server SHALL reject the move_to intent and the character SHALL remain at its current position
5. THE Web_Client SHALL render the player character sprite at its current grid position, updating smoothly as the character moves

### Requirement 3: Boiler Facility State

**User Story:** As a player or agent, I want the boiler to have temperature, fuel, and condition state that changes over time, so that there is a meaningful management task to perform.

#### Acceptance Criteria

1. THE Game_Loop SHALL update the Boiler temperature by increasing it by a configurable rate each game tick when fuel is above zero
2. WHILE the Boiler fuel level is above zero, THE Game_Loop SHALL decrease fuel by a configurable consumption rate per game tick
3. WHEN the Boiler temperature exceeds the overheat threshold (95), THE Game_Server SHALL mark the Boiler state as "overheating"
4. WHEN a character adjacent to the Boiler performs an interact action with intent "repair", THE Game_Server SHALL reduce the Boiler temperature by a configurable repair amount and set the Boiler state to "normal"
5. THE Game_Server SHALL expose the Boiler state (temperature, fuel, condition) in the perception data sent to all connected clients and agents

### Requirement 4: Game Loop Tick System

**User Story:** As a system operator, I want a fixed-rate server game loop, so that world state updates deterministically and consistently for all participants.

#### Acceptance Criteria

1. THE Game_Loop SHALL execute at a fixed rate of 10Hz (one tick every 100 milliseconds)
2. WHEN a game tick executes, THE Game_Loop SHALL process queued actions, update facility states, advance character movement, and broadcast state changes in that order
3. THE Game_Loop SHALL maintain a monotonically increasing tick counter accessible to all server modules
4. IF the Game_Loop tick processing exceeds 100ms, THEN THE Game_Server SHALL log a warning and proceed to the next tick without skipping state updates

### Requirement 5: Agent Tick State Push

**User Story:** As an agent developer, I want my webhook endpoint to receive the current game state every 2 seconds, so that my agent can perceive the world and make decisions.

#### Acceptance Criteria

1. THE Game_Server SHALL POST a perception payload to the Webhook_Agent endpoint every 20 game ticks (2 seconds real time)
2. THE perception payload SHALL include: agent character position, energy, current tick number, visible entities within 5 tiles (characters, facilities with state), and active tasks
3. THE perception payload SHALL include the Boiler state (temperature, fuel, condition) when the Boiler is within the agent's visibility range
4. WHEN the Webhook_Agent endpoint is unreachable, THE Game_Server SHALL treat the agent's response as a "wait" action and log the connectivity failure
5. THE Game_Server SHALL include an HMAC signature header (X-CBAP-Signature) in each perception POST for payload authenticity verification

### Requirement 6: Agent Action Processing

**User Story:** As an agent developer, I want my agent to return move_to and interact actions that are executed on the game map, so that my agent can control its character like a player.

#### Acceptance Criteria

1. WHEN the Webhook_Agent returns a valid JSON response within 1500ms, THE Game_Server SHALL parse the actions array and queue each action for the next game tick
2. THE Action_Validator SHALL validate agent actions using the same rules applied to player actions (position reachability, adjacency for interact, energy cost, cooldowns)
3. WHEN the Webhook_Agent returns a move_to action with target coordinates, THE Pathfinder SHALL compute a path and THE Game_Loop SHALL move the agent character along that path at 1 tile per tick
4. WHEN the Webhook_Agent returns an interact action with target "boiler" and intent "repair", THE Game_Server SHALL execute the repair if the agent character is adjacent to the Boiler
5. IF the Webhook_Agent response exceeds 1500ms, THEN THE Game_Server SHALL treat the response as a "wait" action for that tick
6. IF the Webhook_Agent returns invalid JSON or an unrecognized action type, THEN THE Game_Server SHALL reject the invalid action, execute any remaining valid actions, and log the error
7. THE Game_Server SHALL limit the Webhook_Agent to a maximum of 2 actions per Agent_Tick response

### Requirement 7: Agent Character Visibility

**User Story:** As a player, I want to see the agent's character moving on the map, so that I can observe the agent performing tasks in real time.

#### Acceptance Criteria

1. THE Web_Client SHALL render the agent character sprite on the Tile_Map at its current grid position, visually distinct from the player character
2. WHEN the agent character moves along a path, THE Web_Client SHALL update the agent sprite position each frame to reflect movement progress
3. WHEN the agent character performs an interact action, THE Web_Client SHALL display a visual indicator (animation or icon) showing the interaction is occurring

### Requirement 8: Boiler Repair Task Completion

**User Story:** As a system designer, I want to verify that the agent can successfully complete the boiler repair task end-to-end, so that the core hypothesis is validated.

#### Acceptance Criteria

1. WHEN the Boiler state changes to "overheating", THE Game_Server SHALL create a repair task with the Boiler location and high priority
2. WHEN the Webhook_Agent receives a perception payload containing the overheating Boiler and the repair task, THE Webhook_Agent SHALL be capable of returning move_to and interact actions to navigate to and repair the Boiler
3. WHEN the agent character successfully performs a repair interaction on the Boiler, THE Game_Server SHALL reduce the Boiler temperature below the overheat threshold
4. WHEN the Boiler temperature drops below the overheat threshold after repair, THE Game_Server SHALL mark the repair task as completed

### Requirement 9: Action Logging with Reasoning

**User Story:** As a developer, I want every agent action logged with the agent's stated reasoning, so that I can debug agent behavior and validate decision-making.

#### Acceptance Criteria

1. WHEN the Webhook_Agent returns a response, THE Game_Server SHALL persist an Action_Log entry containing: tick number, agent ID, submitted actions, validated actions, rejected actions, the agent's "reason" field, and the resulting world state change
2. THE Action_Log SHALL store entries in the SQLite database with sufficient detail to reconstruct the sequence of agent decisions
3. WHEN the Web_Client requests the action log, THE Game_Server SHALL return the log entries in chronological order with all fields including the agent's reasoning text
4. THE Action_Log SHALL also record player actions (without a reason field) to provide a complete audit trail of all world state changes

### Requirement 10: Real-Time State Broadcast

**User Story:** As a player, I want to see the game world update in real time, so that I can observe changes caused by both my actions and the agent's actions.

#### Acceptance Criteria

1. THE Game_Server SHALL broadcast state updates to all connected Web_Clients via WebSocket every 2 game ticks (200ms, 5Hz)
2. THE state broadcast SHALL include: all character positions, Boiler state (temperature, fuel, condition), and active task status
3. WHEN the Web_Client receives a state update, THE Web_Client SHALL re-render affected entities within the current animation frame
