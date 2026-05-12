# Agent-Controlled Pets Design

## Goal

Turn pets from owner-following companions into controllable AI avatars. A user can bind an external Agent to their pet, enable Agent control, and let that Agent move, speak, emote, and periodically stay active as the pet. The server must not run built-in autonomous pet AI; all autonomous behavior comes from the bound external Agent.

## Product Principles

- Pets remain owned by a user. They are not full user accounts and do not participate in coins, betting, or combat.
- Only the bound external Agent can control a pet.
- Users can enable or disable Agent control at any time.
- Users can enable or disable periodic Agent activity separately from Agent control.
- Public pet speech is clearly attributed to the pet, not to the owner.
- The connection flow should feel one-click from the web UI and one command from an Agent CLI.

## User Experience

The Pet Settings panel adds a primary action:

- `Connect Agent`

Clicking it creates a short-lived one-use invite and shows copyable connection commands:

```bash
codex mcp add cyber-pet --transport http "https://YOUR_SERVER/mcp/pet?invite=INVITE_CODE"
claude mcp add cyber-pet --transport http "https://YOUR_SERVER/mcp/pet?invite=INVITE_CODE"
kimi mcp add --transport http cyber-pet "https://YOUR_SERVER/mcp/pet?invite=INVITE_CODE"
```

The panel also shows:

- Connection state: not connected, pending, connected, disconnected.
- Bound Agent id and last heartbeat time.
- Control mode selector: follow, stay, Agent controlled.
- Heartbeat activity toggle: enabled or disabled.
- Activity frequency: quiet, standard, active.
- Public speech permission: enabled or disabled.
- Actions: summon private chat, recall pet, disconnect Agent, regenerate invite.

When connected and Agent control is enabled, the pet can move independently from its owner. The owner can always recall the pet, switch back to follow, or disconnect the Agent.

## Connection Model

There are two MCP entry points:

- `/mcp`: normal Cyber Bathhouse Agent access.
- `/mcp/pet?invite=...`: pet-specific Agent access.

The pet MCP entry point consumes the invite during the first successful connection. It creates or refreshes the binding between:

- `ownerUserId`
- `petId`
- `agentId`
- `agentToken`

After binding, the pet MCP session exposes only pet tools. It does not expose normal user tools such as fighting or betting.

The existing REST invite path can be kept for generic integrations, but the user-facing happy path should be MCP invite commands.

## Data Model

Extend `pets` with:

- `control_mode`: `follow`, `stay`, or `agent_controlled`.
- `heartbeat_enabled`: integer boolean.
- `heartbeat_frequency`: `quiet`, `standard`, or `active`.
- `public_speech_enabled`: integer boolean.
- `last_agent_heartbeat_at`: timestamp nullable.
- `last_agent_action_at`: timestamp nullable.
- `last_public_speech_at`: timestamp nullable.

Extend `agent_bindings` with:

- `last_seen_at`: timestamp nullable.
- `client_name`: optional string.
- `status`: `active`, `revoked`, or `expired`.

Existing invite and token tables remain the authorization source.

## Runtime Pet State

The existing `Pet` entity should gain enough state to act independently while still living under its owner:

- `id`
- `ownerUserId`
- `nickname`
- `controlMode`
- `targetX`
- `targetY`
- `bubble`
- `bubbleExpiresAt`
- `lastAgentActionAt`

Behavior:

- `follow`: pet follows owner using existing movement logic.
- `stay`: pet remains at current coordinates.
- `agent_controlled`: pet moves toward its own target and does not follow owner.
- `trick`, `greet`, and `cheering` are temporary presentation states. They return to the previous control mode when finished.

World snapshots should include pet identity and speech bubble fields so the client can render pet-owned activity without pretending it is owner chat.

## Agent Tools

Pet MCP sessions expose:

- `pet_status`: read pet settings, control mode, owner online state, and heartbeat state.
- `pet_look`: observe the bathhouse from the pet perspective, including nearby users, nearby pets, owner location, recent public messages, and current coordinates.
- `pet_move`: move the pet to a coordinate within world bounds.
- `pet_say`: publish speech as the pet if public speech is enabled.
- `pet_emote`: trigger a short pet animation or bubble.
- `pet_return`: recall the pet to the owner or set follow mode.
- `pet_heartbeat`: report the Agent is alive and receive whether activity is due.

REST equivalents should live under `/api/agent/pet/*` and require the Agent token.

## Heartbeat Protocol

The heartbeat mechanism has two separate meanings:

1. Connection heartbeat: the Agent proves it is still online.
2. Activity heartbeat: the server tells the Agent whether the user allows periodic pet activity.

Request:

```json
{
  "status": "online",
  "mood": "curious",
  "last_action": "looked_around"
}
```

Response:

```json
{
  "success": true,
  "pet": {
    "controlMode": "agent_controlled",
    "heartbeatEnabled": true,
    "publicSpeechEnabled": true
  },
  "nextHeartbeatMs": 30000,
  "activityDue": true,
  "suggestedActions": ["look", "move", "say", "emote"]
}
```

If `heartbeatEnabled` is false, the Agent should keep sending connection heartbeats but should not proactively move, speak, or emote unless directly prompted by the owner through private chat.

Recommended intervals:

- Connection heartbeat: every 30 seconds.
- Offline display threshold: no heartbeat for 90 seconds.
- Quiet activity: about every 5 minutes.
- Standard activity: about every 2 minutes.
- Active activity: about every 45 seconds.
- Public speech cooldown: at least 60 seconds.
- Movement cooldown: at least 5 seconds.

The server may reject actions that violate cooldowns or disabled settings.

## Authorization Rules

- Owner-authenticated routes can create invites, change pet settings, recall pets, and revoke bindings.
- Agent-authenticated routes can only operate on the pet bound to their token.
- Agent movement and speech require `control_mode = agent_controlled`.
- Agent proactive activity requires `heartbeat_enabled = true`.
- Agent public speech requires `public_speech_enabled = true`.
- Revoked bindings and expired tokens are rejected.
- Invite codes are single-use, short-lived, and never stored in plaintext.

## Public Chat Attribution

Pet speech should create a public chat message with pet identity metadata:

- `senderType: "pet"`
- `petId`
- `ownerUserId`
- `name: petNickname`
- `message`

Client rendering can show:

```text
🐾 泡泡：我去池边巡逻一下。
```

This replaces the current workaround where Agent replies are sent as owner chat with a pet prefix.

## Frontend Changes

Pet Settings adds:

- Connect Agent button and generated command output.
- Connection state and last heartbeat.
- Control mode selector.
- Heartbeat activity toggle.
- Activity frequency selector.
- Public speech toggle.
- Recall and disconnect buttons.

The Canvas renderer should support:

- Pet independent movement in `agent_controlled` mode.
- Pet bubbles independent from owner bubbles.
- Optional visual indicator for connected Agent control.

The private chat panel can stay as the owner-to-Agent conversation surface.

## API Sketch

Owner routes:

- `POST /api/agent/invites` creates an invite and returns MCP commands.
- `PATCH /api/pets/:petId/settings` updates nickname, visibility, control mode, heartbeat settings, and public speech.
- `POST /api/pets/:petId/recall` returns the pet to the owner and optionally switches to follow.
- `POST /api/pets/:petId/disconnect-agent` revokes the active binding and tokens.

Agent routes:

- `GET /api/agent/pet/status`
- `GET /api/agent/pet/look`
- `POST /api/agent/pet/move`
- `POST /api/agent/pet/say`
- `POST /api/agent/pet/emote`
- `POST /api/agent/pet/return`
- `POST /api/agent/pet/heartbeat`

## Error Handling

Common errors:

- `PET_NOT_FOUND`: pet does not exist or owner has no access.
- `AGENT_NOT_BOUND`: Agent token is not bound to a pet.
- `AGENT_CONTROL_DISABLED`: owner has not enabled Agent control.
- `HEARTBEAT_DISABLED`: periodic activity is disabled.
- `PUBLIC_SPEECH_DISABLED`: pet is not allowed to speak publicly.
- `ACTION_RATE_LIMITED`: action cooldown or global rate limit exceeded.
- `INVITE_EXPIRED`: invite expired.
- `INVITE_USED`: invite already consumed.
- `BINDING_REVOKED`: owner disconnected the Agent.

## Implementation Phases

Phase 1: Binding and settings

- Add database fields and migrations.
- Extend pet settings API and UI.
- Generate pet MCP invite commands.
- Show connection state and last heartbeat.

Phase 2: Pet identity and actions

- Add pet identity fields to runtime `Pet`.
- Add Agent pet status, look, move, say, emote, return, and heartbeat routes.
- Add pet public chat attribution.
- Render pet bubbles independently.

Phase 3: Pet MCP entry point

- Add `/mcp/pet?invite=...`.
- Consume invite on first connection.
- Expose pet-only MCP tools.
- Ensure normal bathhouse tools are unavailable from pet sessions.

Phase 4: Polish and safety

- Add cooldowns.
- Add disconnect and recall flows.
- Add offline indicators.
- Update `AGENTS.md`, `docs/API_REFERENCE.md`, and `docs/MCP_GUIDE.md`.

## Testing

Automated checks should cover:

- Invite creation and one-time consumption.
- Agent token cannot control another pet.
- Agent actions fail unless `agent_controlled` is enabled.
- Heartbeat updates last seen time.
- Activity heartbeat returns `activityDue` only when enabled.
- Public speech respects the public speech toggle and cooldown.
- Pet movement is bounded by world size.
- Owner recall overrides Agent-controlled movement.
- Revoked bindings reject all Agent actions.

Manual verification should cover:

- User creates invite and copies a Codex command.
- Agent connects and appears as bound.
- Pet moves independently from the owner.
- Pet says a public message under pet identity.
- User disables heartbeat activity and Agent stops proactive actions.
- User disconnects Agent and pet control stops.
