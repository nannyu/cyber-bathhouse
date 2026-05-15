/**
 * v2 游戏模块入口 — 初始化 Room、GameLoop、AgentTick、ActionLogger
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Room } from './Room.js';
import { GameLoop } from './GameLoop.js';
import { AgentTick } from './AgentTick.js';
import { ActionLogger } from './ActionLogger.js';
import { initWebSocketV2 } from './websocket-v2.js';
import { GAME_CONFIG } from './config-v2.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 初始化 v2 游戏系统
 * @param {import('socket.io').Server} io
 * @param {import('better-sqlite3').Database} db - SQLite 数据库实例
 * @param {import('../api/auth.js').AuthManager} auth
 * @param {import('express').Router} router - Express router 挂载 v2 REST 路由
 * @returns {{ room: Room, gameLoop: GameLoop }}
 */
export function initGameV2(io, db, auth, router) {
    // 加载地图
    const mapPath = resolve(__dirname, '../../maps/bathhouse_phase0.json');
    const mapData = JSON.parse(readFileSync(mapPath, 'utf8'));

    // 创建房间
    const room = new Room(mapData);
    console.log(`[Game-v2] Room created: ${room.id} (${room.map.width}x${room.map.height})`);

    // 创建日志器
    const logger = new ActionLogger(db, room.id);

    // 创建 GameLoop
    const gameLoop = new GameLoop(room, {
        onActionLog: (entry) => {
            logger.log(entry);
        },
    });

    // 创建 AgentTick
    const agentTick = new AgentTick(gameLoop);

    // 设置 Agent Tick 回调
    gameLoop.onAgentTick = (agent, perception) => {
        agentTick.pushAndProcess(agent, perception);
    };

    // 初始化 WebSocket
    initWebSocketV2(io, gameLoop, room, auth);

    // REST 路由
    _mountRoutes(router, room, gameLoop, logger);

    // 启动 GameLoop
    gameLoop.start();
    console.log(`[Game-v2] GameLoop started at ${GAME_CONFIG.TICK_RATE}Hz`);

    return { room, gameLoop };
}

/**
 * 挂载 v2 REST 路由
 */
function _mountRoutes(router, room, gameLoop, logger) {
    // 获取房间状态
    router.get('/v2/room/state', (req, res) => {
        res.json({ success: true, state: room.getState() });
    });

    // 获取地图数据
    router.get('/v2/room/map', (req, res) => {
        res.json({ success: true, map: room.map.toJSON() });
    });

    // 注册 Agent（设置 webhook endpoint）
    router.post('/v2/agent/register', (req, res) => {
        const { agent_id, name, endpoint, api_key } = req.body || {};
        if (!agent_id || !endpoint) {
            return res.status(400).json({ success: false, error: 'agent_id and endpoint required' });
        }

        // 添加或更新 Agent 角色
        let character = room.getCharacter(agent_id);
        if (!character) {
            character = room.addCharacter({
                id: agent_id,
                type: 'agent',
                name: name || agent_id,
                endpoint,
                apiKey: api_key,
            });
        } else {
            character.endpoint = endpoint;
            character.apiKey = api_key || character.apiKey;
        }

        res.json({
            success: true,
            agent_id: character.id,
            position: { x: character.x, y: character.y },
            room_id: room.id,
        });
    });

    // 查询动作日志
    router.get('/v2/action-log', (req, res) => {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = parseInt(req.query.offset) || 0;
        const logs = logger.query({ limit, offset });
        const total = logger.count();
        res.json({ success: true, logs, total, limit, offset });
    });

    // 手动提交动作（REST 方式，供调试）
    router.post('/v2/action', (req, res) => {
        const { actor_id, actions, reason } = req.body || {};
        if (!actor_id || !actions) {
            return res.status(400).json({ success: false, error: 'actor_id and actions required' });
        }
        const result = gameLoop.submitActions(actor_id, Array.isArray(actions) ? actions : [actions], reason);
        res.json({ success: true, ...result });
    });
}
