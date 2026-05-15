/**
 * WebSocket v2 事件处理
 */

import { GAME_CONFIG } from './config-v2.js';

/**
 * 初始化 v2 WebSocket 事件
 * @param {import('socket.io').Server} io
 * @param {import('./GameLoop.js').GameLoop} gameLoop
 * @param {import('./Room.js').Room} room
 * @param {import('../api/auth.js').AuthManager} auth
 */
export function initWebSocketV2(io, gameLoop, room, auth) {
    const v2Namespace = io.of('/v2');

    // 认证中间件（Phase 0 开发模式允许 dev token）
    v2Namespace.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('AUTH_REQUIRED'));

        // Phase 0 开发 token 快捷通道
        if (token === 'phase0-dev-token') {
            socket.userId = 'dev_player_001';
            socket.userName = 'DevPlayer';
            socket.userType = 'player';
            return next();
        }

        const result = auth.validate(token);
        if (!result.valid) return next(new Error('AUTH_REQUIRED'));

        socket.userId = result.userId;
        socket.userName = result.name;
        socket.userType = result.type;
        next();
    });

    // 设置广播回调
    gameLoop.onBroadcast = (state) => {
        v2Namespace.emit('state:update', state);
    };

    v2Namespace.on('connection', (socket) => {
        console.log(`[WS-v2] 连接: ${socket.userName} (${socket.userId})`);

        // 加入房间
        socket.on('room:join', () => {
            // 添加角色（如果不存在）
            let character = room.getCharacter(socket.userId);
            if (!character) {
                character = room.addCharacter({
                    id: socket.userId,
                    type: socket.userType === 'agent' ? 'agent' : 'player',
                    name: socket.userName,
                });
            }

            // 发送初始状态 + 地图数据
            socket.emit('room:joined', {
                roomId: room.id,
                map: room.map.toJSON(),
                state: room.getState(),
                characterId: character.id,
            });
        });

        // 处理动作
        socket.on('action', (data) => {
            if (!data || typeof data !== 'object') return;

            const actions = Array.isArray(data.actions) ? data.actions : [data];
            const result = gameLoop.submitActions(socket.userId, actions);

            // 通知被拒绝的动作
            if (result.rejected.length > 0) {
                socket.emit('action:rejected', {
                    rejected: result.rejected.map(r => ({ reason: r.reason })),
                });
            }
        });

        // 聊天
        socket.on('chat', (data) => {
            if (!data?.text || typeof data.text !== 'string') return;
            v2Namespace.emit('chat:message', {
                userId: socket.userId,
                name: socket.userName,
                text: data.text.slice(0, 500),
                tick: room.tick,
            });
        });

        // 断开
        socket.on('disconnect', () => {
            console.log(`[WS-v2] 断开: ${socket.userName} (${socket.userId})`);
            // 保留角色在房间中（可配置是否移除）
        });
    });

    return v2Namespace;
}
