/**
 * Phase 0 E2E 冒烟测试 — 无需浏览器
 * 验证：房间创建 → 角色添加 → 锅炉过热 → Agent 感知 → Agent 修理 → 日志记录
 */

import assert from 'assert/strict';
import { readFileSync } from 'fs';
import { Room } from '../server/game/Room.js';
import { GameLoop } from '../server/game/GameLoop.js';
import { GAME_CONFIG } from '../server/game/config-v2.js';

console.log('=== Phase 0 Smoke Test ===\n');

// 1. 创建房间
const mapData = JSON.parse(readFileSync('maps/bathhouse_phase0.json', 'utf8'));
const room = new Room(mapData);
assert.ok(room.id.startsWith('room_'));
assert.equal(room.map.width, 20);
assert.equal(room.map.height, 13);
console.log('✅ 1. Room created:', room.id);

// 2. 添加角色
const player = room.addCharacter({ id: 'player_1', type: 'player', name: 'Alice' });
const agent = room.addCharacter({ id: 'agent_1', type: 'agent', name: 'Bot', endpoint: 'http://localhost:9999/tick' });
assert.equal(player.x, 4);
assert.equal(player.y, 2);
assert.equal(agent.x, 6);
assert.equal(agent.y, 2);
console.log('✅ 2. Characters added: player at (4,2), agent at (6,2)');

// 3. 创建 GameLoop
const logs = [];
const broadcasts = [];
const agentPerceptions = [];

const gameLoop = new GameLoop(room, {
    onBroadcast: (state) => broadcasts.push(state),
    onAgentTick: (agentChar, perception) => agentPerceptions.push({ agentChar, perception }),
    onActionLog: (entry) => logs.push(entry),
});

// 4. 模拟 ticks 直到锅炉过热
const boiler = room.getFacility('boiler_01');
assert.ok(boiler);
assert.equal(boiler.state.temperature, GAME_CONFIG.BOILER.INITIAL_TEMP);

let overheatedAtTick = -1;
for (let i = 0; i < 300; i++) {
    gameLoop.manualTick();
    if (boiler.isOverheating() && overheatedAtTick < 0) {
        overheatedAtTick = room.tick;
    }
    // 过热后再跑到下一个 Agent Tick 确保感知包含任务
    if (overheatedAtTick > 0 && room.tick >= overheatedAtTick + GAME_CONFIG.AGENT_TICK_INTERVAL) {
        break;
    }
}
assert.ok(overheatedAtTick > 0, 'Boiler should overheat within 300 ticks');
assert.equal(boiler.state.status, 'overheating');
console.log(`✅ 3. Boiler overheated at tick ${overheatedAtTick} (temp: ${boiler.state.temperature.toFixed(1)}°C)`);

// 5. 验证任务自动生成
const tasks = room.taskManager.getActiveTasks();
assert.ok(tasks.length > 0, 'Should have at least one repair task');
assert.equal(tasks[0].requiredAction, 'repair');
console.log(`✅ 4. Repair task generated: "${tasks[0].title}"`);

// 6. 验证 Agent 感知推送（tick % 20 === 0 时触发）
assert.ok(agentPerceptions.length > 0, 'Agent should have received perceptions');
const lastPerception = agentPerceptions[agentPerceptions.length - 1].perception;
assert.ok(lastPerception.visible_entities.length > 0);
assert.ok(lastPerception.active_tasks.length > 0);
console.log(`✅ 5. Agent received ${agentPerceptions.length} perception(s), last has ${lastPerception.visible_entities.length} entities`);

// 7. 模拟 Agent 移动到锅炉旁边（直接设置位置，模拟已到达）
agent.x = 11;
agent.y = 8; // 锅炉 (12,8) 的左侧
console.log(`✅ 6. Agent positioned at (11,8) adjacent to boiler`);

// 8. Agent 修理锅炉
const repairResult = gameLoop.submitActions('agent_1', [
    { type: 'interact', targetId: 'boiler_01', intent: 'repair' }
], 'Boiler overheating, performing repair');
assert.equal(repairResult.validated.length, 1);
assert.equal(repairResult.rejected.length, 0);

// 执行一个 tick 让修理生效
gameLoop.manualTick();

assert.ok(boiler.state.temperature < GAME_CONFIG.BOILER.OVERHEAT_THRESHOLD, 'Boiler temp should be below threshold after repair');
assert.equal(boiler.state.status, 'normal');
console.log(`✅ 7. Boiler repaired: temp ${boiler.state.temperature.toFixed(1)}°C, status: ${boiler.state.status}`);

// 9. 验证任务完成
const completedTasks = room.taskManager.getAllTasks().filter(t => t.status === 'completed');
assert.ok(completedTasks.length > 0, 'Repair task should be completed');
console.log(`✅ 8. Task completed: "${completedTasks[0].title}"`);

// 10. 验证日志
assert.ok(logs.length >= 1, 'Should have at least 1 log entry');
const agentLog = logs.find(l => l.actorId === 'agent_1' && l.reason);
assert.ok(agentLog, 'Should have agent log with reason');
assert.ok(agentLog.reason.includes('repair') || agentLog.reason.includes('Boiler'));
console.log(`✅ 9. Action logs: ${logs.length} entries, agent reason: "${agentLog.reason}"`);

// 11. 验证广播
assert.ok(broadcasts.length > 0, 'Should have state broadcasts');
const lastBroadcast = broadcasts[broadcasts.length - 1];
assert.ok(lastBroadcast.characters.length === 2);
assert.ok(lastBroadcast.facilities.length > 0);
console.log(`✅ 10. Broadcasts: ${broadcasts.length} state updates sent`);

console.log('\n=== ALL TESTS PASSED ===');
console.log(JSON.stringify({
    ok: true,
    ticks: room.tick,
    overheatedAt: overheatedAtTick,
    logs: logs.length,
    broadcasts: broadcasts.length,
    agentPerceptions: agentPerceptions.length,
}));
