/**
 * v2 前端入口
 */

import { io } from 'socket.io-client';
import { GameV2 } from './engine/GameV2.js';

const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const canvas = document.getElementById('game-canvas');

let socket = null;
let game = null;

function log(msg) {
    const line = document.createElement('div');
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
}

// 连接 WebSocket (v2 namespace)
function connect() {
    // 使用匿名 token（Phase 0 简化，不做认证）
    socket = io('/v2', {
        auth: { token: 'phase0-dev-token' },
    });

    socket.on('connect', () => {
        statusEl.textContent = '🟢 已连接';
        log('WebSocket 已连接');
    });

    socket.on('disconnect', () => {
        statusEl.textContent = '🔴 已断开';
        log('WebSocket 断开');
    });

    socket.on('connect_error', (err) => {
        statusEl.textContent = `🔴 连接失败: ${err.message}`;
        log(`连接错误: ${err.message}`);
    });

    socket.on('room:joined', (data) => {
        log(`加入房间 ${data.roomId}，角色 ID: ${data.characterId}`);
        game.myCharacterId = data.characterId;
        game.setMap(data.map);
        game.updateState(data.state);
        game.start();
    });

    socket.on('state:update', (state) => {
        game.updateState(state);
    });

    socket.on('action:rejected', (data) => {
        for (const r of data.rejected || []) {
            log(`❌ 动作被拒绝: ${r.reason}`);
        }
    });

    socket.on('chat:message', (msg) => {
        log(`💬 ${msg.name}: ${msg.text}`);
    });
}

// 初始化游戏
game = new GameV2(canvas, {
    onAction: (action) => {
        if (!socket?.connected) return;
        socket.emit('action', action);
        log(`→ 发送动作: ${action.type} ${action.x != null ? `(${action.x},${action.y})` : action.targetId || ''}`);
    },
});

// 按钮事件
document.getElementById('btn-join').addEventListener('click', () => {
    if (!socket?.connected) {
        log('未连接，无法加入');
        return;
    }
    socket.emit('room:join');
    log('请求加入房间...');
});

document.getElementById('btn-register-agent').addEventListener('click', async () => {
    try {
        const res = await fetch('/api/v2/agent/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agent_id: 'test_agent_001',
                name: 'TestBot',
                endpoint: 'http://localhost:9999/tick',
            }),
        });
        const data = await res.json();
        if (data.success) {
            log(`✅ Agent 注册成功: ${data.agent_id} at (${data.position.x},${data.position.y})`);
        } else {
            log(`❌ Agent 注册失败: ${data.error}`);
        }
    } catch (err) {
        log(`❌ 请求失败: ${err.message}`);
    }
});

// 启动连接
connect();
