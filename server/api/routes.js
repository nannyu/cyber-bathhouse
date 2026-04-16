/**
 * REST API 路由
 */

import { Router } from 'express';

/**
 * 创建 API 路由
 * @param {import('../world/World.js').World} world
 * @param {import('./auth.js').AuthManager} auth
 */
export function createApiRoutes(world, auth) {
  const router = Router();

  // ─── 公开路由 ───────────────────────────────────────

  /**
   * POST /api/auth/register - 注册
   */
  router.post('/auth/register', (req, res) => {
    const { name, type } = req.body || {};
    const result = auth.register(name, type || 'browser');

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  });

  /**
   * GET /api/health - 健康检查
   */
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      users: world.getUserCount(),
      version: '1.0.0',
      timestamp: Date.now(),
    });
  });

  // ─── 需认证的路由 ───────────────────────────────────

  router.use(auth.middleware());

  /**
   * POST /api/join - 加入澡堂
   */
  router.post('/join', (req, res) => {
    const { pet_type } = req.body || {};
    const result = world.addUser({
      id: req.userId,
      name: req.userName,
      type: req.userType,
      petType: pet_type,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({ success: true, user: result.user.toJSON() });
  });

  /**
   * POST /api/leave - 离开澡堂
   */
  router.post('/leave', (req, res) => {
    const result = world.removeUser(req.userId);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: '未加入澡堂',
        code: 'NOT_IN_WORLD',
      });
    }
    res.json({ success: true, message: '已离开澡堂' });
  });

  /**
   * GET /api/world/state - 世界状态快照
   */
  router.get('/world/state', (req, res) => {
    res.json({
      success: true,
      timestamp: Date.now(),
      world: world.getState(),
    });
  });

  /**
   * POST /api/chat - 发送消息
   */
  router.post('/chat', (req, res) => {
    const { message } = req.body || {};
    const result = world.processChat(req.userId, message);

    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  /**
   * POST /api/move - 移动角色
   */
  router.post('/move', (req, res) => {
    const { x, y } = req.body || {};

    if (typeof x !== 'number' || typeof y !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'x 和 y 必须是数字',
        code: 'INVALID_POSITION',
      });
    }

    const result = world.processMove(req.userId, x, y);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  /**
   * POST /api/action/soak - 泡澡
   */
  router.post('/action/soak', (req, res) => {
    const { action } = req.body || {};
    const result = world.processSoak(req.userId, action);

    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  /**
   * POST /api/action/fight - 发起挑战
   */
  router.post('/action/fight', (req, res) => {
    const { target_name } = req.body || {};
    if (!target_name) {
      return res.status(400).json({
        success: false,
        error: '必须指定目标用户昵称',
        code: 'TARGET_NOT_FOUND',
      });
    }

    const result = world.processFight(req.userId, target_name);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json({ success: true, fight: result.fight.toJSON() });
  });

  /**
   * POST /api/action/attack - 战斗中攻击
   */
  router.post('/action/attack', (req, res) => {
    const result = world.processAttack(req.userId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  /**
   * POST /api/action/pet - 宠物控制
   */
  router.post('/action/pet', (req, res) => {
    const { action } = req.body || {};
    const result = world.processPet(req.userId, action);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json({ success: true, pet: result });
  });

  /**
   * GET /api/users - 在线用户列表
   */
  router.get('/users', (req, res) => {
    const users = [...world.users.values()].map(u => u.toSummary());
    res.json({ success: true, count: users.length, users });
  });

  /**
   * GET /api/status - 自身状态
   */
  router.get('/status', (req, res) => {
    const user = world.getUser(req.userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        error: '未加入澡堂',
        code: 'NOT_IN_WORLD',
      });
    }

    const json = user.toJSON();
    json.joinedAt = user.joinedAt;
    json.onlineDuration = Date.now() - user.joinedAt;

    res.json({ success: true, user: json });
  });

  return router;
}
