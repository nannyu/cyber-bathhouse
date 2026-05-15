/**
 * v2 测试 Agent — 简单规则：锅炉过热时走过去修理
 *
 * 用法: node scripts/test-agent-v2.js
 * 先启动服务端，然后在 v2 页面点击"注册测试 Agent"
 */

import http from 'http';

const PORT = 9999;

const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/tick') {
        res.writeHead(404);
        res.end();
        return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        try {
            const perception = JSON.parse(body);
            const response = decide(perception);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
        } catch (err) {
            console.error('[TestAgent] Parse error:', err.message);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ actions: [{ type: 'wait' }], reason: 'Parse error, waiting.' }));
        }
    });
});

/**
 * 决策逻辑
 */
function decide(perception) {
    const { location, visible_entities, active_tasks } = perception;

    // 查找过热的锅炉
    const overheatingBoiler = visible_entities?.find(
        e => e.type === 'facility' && e.facilityType === 'boiler' && e.state?.status === 'overheating'
    );

    // 查找修理任务
    const repairTask = active_tasks?.find(t => t.requiredAction === 'repair');

    if (overheatingBoiler || repairTask) {
        const target = overheatingBoiler || { x: repairTask?.location?.x, y: repairTask?.location?.y };
        const targetId = overheatingBoiler?.id || repairTask?.targetId;

        // 检查是否相邻
        const dx = Math.abs(location.x - target.x);
        const dy = Math.abs(location.y - target.y);
        const adjacent = (dx + dy) === 1;

        if (adjacent && targetId) {
            // 相邻 → 修理
            console.log(`[TestAgent] Tick ${perception.tick}: Repairing ${targetId} (temp: ${target.state?.temperature || '?'}°C)`);
            return {
                actions: [{ type: 'interact', targetId, intent: 'repair' }],
                reason: `Boiler ${targetId} is overheating. Adjacent, performing repair.`,
            };
        } else {
            // 不相邻 → 移动到旁边（目标左侧）
            const moveX = target.x - 1;
            const moveY = target.y;
            console.log(`[TestAgent] Tick ${perception.tick}: Moving to (${moveX},${moveY}) to repair boiler`);
            return {
                actions: [{ type: 'move_to', x: moveX, y: moveY }],
                reason: `Boiler is overheating at (${target.x},${target.y}). Moving adjacent to repair.`,
            };
        }
    }

    // 无紧急任务 → 等待
    console.log(`[TestAgent] Tick ${perception.tick}: Idle at (${location.x},${location.y}), no urgent tasks.`);
    return {
        actions: [{ type: 'wait' }],
        reason: 'No urgent tasks. Waiting for instructions.',
    };
}

server.listen(PORT, () => {
    console.log(`[TestAgent] 🤖 Test Agent listening on http://localhost:${PORT}/tick`);
    console.log('[TestAgent] Waiting for CBAP perception pushes from game server...');
});
