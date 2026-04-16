/**
 * WebSocket 事件处理 (Socket.IO)
 */

import { CONFIG } from '../config.js';

/**
 * 初始化 WebSocket 事件
 * @param {import('socket.io').Server} io
 * @param {import('../world/World.js').World} world
 * @param {import('../api/auth.js').AuthManager} auth
 */
export function initWebSocket(io, world, auth) {
  // 认证中间件
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('AUTH_REQUIRED'));
    }

    const result = auth.validate(token);
    if (!result.valid) {
      return next(new Error('AUTH_REQUIRED'));
    }

    socket.userId = result.userId;
    socket.userName = result.name;
    socket.userType = result.type;
    next();
  });

  // 设置广播回调
  world.setBroadcast((event, data) => {
    io.emit(event, data);
  });

  io.on('connection', (socket) => {
    console.log(`[WS] 连接: ${socket.userName} (${socket.userId})`);

    // 发送当前世界状态
    socket.emit('world:state', world.getState());

    // ─── 聊天 ─────────────────
    socket.on('chat', (data) => {
      if (!data?.message) return;
      world.processChat(socket.userId, data.message);
    });

    // ─── 移动 ─────────────────
    socket.on('move', (data) => {
      if (typeof data?.x !== 'number' || typeof data?.y !== 'number') return;
      world.processMove(socket.userId, data.x, data.y);
    });

    // ─── 动作 ─────────────────
    socket.on('action', (data) => {
      if (!data?.type) return;

      switch (data.type) {
        case 'soak':
          world.processSoak(socket.userId, data.action);
          break;
        case 'fight':
          world.processFight(socket.userId, data.targetName);
          break;
        case 'attack':
          world.processAttack(socket.userId);
          break;
        case 'pet':
          world.processPet(socket.userId, data.action);
          break;
      }
    });

    // ─── 加入 ─────────────────
    socket.on('join', (data) => {
      world.addUser({
        id: socket.userId,
        name: socket.userName,
        type: socket.userType,
        petType: data?.pet_type,
      });
    });

    // ─── 离开 ─────────────────
    socket.on('leave', () => {
      world.removeUser(socket.userId);
    });

    // ─── 断开连接 ─────────────
    socket.on('disconnect', () => {
      console.log(`[WS] 断开: ${socket.userName} (${socket.userId})`);
      // 浏览器用户断开时移除
      if (socket.userType === 'browser') {
        world.removeUser(socket.userId);
      }
      // Agent 用户断开时保留一段时间（MCP 可能重连）
    });
  });

  // ─── 世界 Tick 循环 ─────────────────────────────────
  const tickInterval = 1000 / CONFIG.TICK_RATE;
  let lastTick = Date.now();

  setInterval(() => {
    const now = Date.now();
    const dt = now - lastTick;
    lastTick = now;

    // 更新世界
    world.tick(dt);

    // 广播世界状态
    io.emit('world:update', world.getState());
  }, tickInterval);
}
