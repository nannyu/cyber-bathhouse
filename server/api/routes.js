/**
 * REST API 路由
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { CONFIG } from '../config.js';

/**
 * 创建 API 路由
 * @param {import('../world/World.js').World} world
 * @param {import('./auth.js').AuthManager} auth
 */
export function createApiRoutes(world, auth) {
  const router = Router();
  const INVITE_TTL_MS = 10 * 60 * 1000;
  const AGENT_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const hashInviteCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

  /**
   * 解析加入澡堂时的宠物类型：优先使用本次请求里显式传入的有效类型，否则用档案，再否则默认第一种
   */
  function resolveJoinPetType(bodyPet, profilePet) {
    const b = typeof bodyPet === 'string' ? bodyPet.trim() : '';
    if (b && CONFIG.PET_TYPES.includes(b)) {
      return { resolved: b, usedClientBody: true };
    }
    const p = typeof profilePet === 'string' ? profilePet.trim() : '';
    if (p && CONFIG.PET_TYPES.includes(p)) {
      return { resolved: p, usedClientBody: false };
    }
    return { resolved: CONFIG.PET_TYPES[0], usedClientBody: false };
  }

  // ─── 公开路由 ───────────────────────────────────────

  /**
   * POST /api/auth/register - 注册
   */
  router.post('/auth/register', (req, res) => {
    const { username, password, nickname, type, pet_type } = req.body || {};
    const ip = req.ip || req.connection.remoteAddress;
    const result = auth.register(username, password, nickname, type || 'browser', ip, pet_type);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.cookie('auth_token', result.token, { maxAge: 86400000, httpOnly: false });
    res.json(result);
  });

  /**
   * POST /api/auth/login - 登录
   */
  router.post('/auth/login', (req, res) => {
    const { username, password, type } = req.body || {};
    const result = auth.login(username, password, type || 'browser');

    if (!result.success) {
      return res.status(401).json(result);
    }

    res.cookie('auth_token', result.token, { maxAge: 86400000, httpOnly: false });
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

  router.get('/agent/spec', (req, res) => {
    res.json({
      success: true,
      auth: {
        consumeInvite: 'POST /api/agent/invites/consume',
        bearerToken: 'Authorization: Bearer <agent_access_token>',
      },
      endpoints: [
        { method: 'GET', path: '/api/agent/private-chat/inbox?since=0', desc: '拉取主人私聊消息' },
        { method: 'POST', path: '/api/agent/private-chat/reply', body: { content: 'string' }, desc: '回复主人私聊消息' },
      ],
    });
  });

  // ─── 需认证的路由 ───────────────────────────────────

  const userAuthMiddleware = auth.middleware();
  router.use((req, res, next) => {
    const isPublicAgentEndpoint =
      req.path === '/agent/spec' ||
      req.path === '/agent/invites/consume' ||
      // agent token 专用接口：需要走下面的 agentAuth 中间件
      req.path === '/agent/private-chat/inbox' ||
      req.path === '/agent/private-chat/reply';
    if (isPublicAgentEndpoint) {
      return next();
    }
    return userAuthMiddleware(req, res, next);
  });

  /**
   * GET /api/auth/me - 当前登录信息
   */
  router.get('/auth/me', (req, res) => {
    res.json({
      success: true,
      userId: req.userId,
      name: req.userName,
      type: req.userType,
      role: req.userRole,
    });
  });

  /**
   * POST /api/auth/logout - 退出登录（作废会话并清除 Cookie）
   */
  router.post('/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    auth.logoutToken(token);
    res.clearCookie('auth_token');
    res.json({ success: true });
  });

  /**
   * POST /api/auth/password - 修改登录密码
   */
  router.post('/auth/password', (req, res) => {
    const { current_password, new_password } = req.body || {};
    const result = auth.changePassword(req.userId, current_password, new_password);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json({ success: true, message: '密码修改成功' });
  });

  /**
   * POST /api/join - 加入澡堂
   */
  router.post('/join', (req, res) => {
    const { pet_type } = req.body || {};
    const petProfile = auth.database.getPetByOwnerUserId(req.userId);
    const { resolved: resolvedPetType, usedClientBody } = resolveJoinPetType(pet_type, petProfile?.petType);

    if (usedClientBody && petProfile && resolvedPetType !== petProfile.petType) {
      auth.database.updatePetTypeByOwnerUserId(req.userId, resolvedPetType);
    }

    const result = world.addUser({
      id: req.userId,
      name: req.userName,
      type: req.userType,
      petType: resolvedPetType,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    const userJson = result.user.toJSON();
    const profileAfter = auth.database.getPetByOwnerUserId(req.userId);
    if (profileAfter?.petNickname) {
      userJson.pet.nickname = profileAfter.petNickname;
    }
    if (profileAfter?.petCode) {
      userJson.pet.petCode = profileAfter.petCode;
    }
    res.json({ success: true, user: userJson, petProfile: profileAfter || petProfile });
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
   * GET /api/combat/lines - 获取宠物风格战斗台词池
   */
  router.get('/combat/lines', (req, res) => {
    const lines = auth.database.listCombatLines();
    res.json({ success: true, lines });
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

  /**
   * GET /api/pets/me - 获取当前用户宠物资料
   */
  router.get('/pets/me', (req, res) => {
    const petProfile = auth.database.getPetByOwnerUserId(req.userId);
    if (!petProfile) {
      return res.status(404).json({
        success: false,
        error: '未找到宠物资料',
        code: 'PET_NOT_FOUND',
      });
    }
    res.json({ success: true, pet: petProfile });
  });

  /**
   * PATCH /api/pets/:petId/settings - 更新宠物设置
   */
  router.patch('/pets/:petId/settings', (req, res) => {
    const { petId } = req.params;
    const { pet_nickname, chat_visibility } = req.body || {};
    const petProfile = auth.database.getPetById(petId);

    if (!petProfile || petProfile.ownerUserId !== req.userId) {
      return res.status(404).json({
        success: false,
        error: '宠物不存在或无权操作',
        code: 'PET_NOT_FOUND',
      });
    }

    if (typeof pet_nickname !== 'string' || pet_nickname.trim().length < 1 || pet_nickname.trim().length > 20) {
      return res.status(400).json({
        success: false,
        error: '宠物昵称长度必须在 1-20 字符之间',
        code: 'INVALID_PET_NICKNAME',
      });
    }
    if (chat_visibility !== 'public' && chat_visibility !== 'private') {
      return res.status(400).json({
        success: false,
        error: 'chat_visibility 必须是 public 或 private',
        code: 'INVALID_CHAT_VISIBILITY',
      });
    }

    const updated = auth.database.updatePetSettings(petId, pet_nickname.trim(), chat_visibility);
    res.json({ success: true, pet: updated });
  });

  router.post('/agent/invites', (req, res) => {
    const baseUrl = CONFIG.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const pet = auth.database.getPetByOwnerUserId(req.userId);
    if (!pet) {
      return res.status(404).json({ success: false, error: '未找到宠物', code: 'PET_NOT_FOUND' });
    }
    const inviteCode = `agi_${crypto.randomBytes(16).toString('hex')}`;
    const now = Date.now();
    auth.database.createAgentInvite({
      id: `inv_${uuidv4().slice(0, 8)}`,
      ownerUserId: req.userId,
      petId: pet.id,
      inviteCodeHash: hashInviteCode(inviteCode),
      expiresAt: now + INVITE_TTL_MS,
      maxUses: 1,
      usedCount: 0,
      createdAt: now,
    });
    const inviteUrl = `${baseUrl}/agent-invite?code=${encodeURIComponent(inviteCode)}&server=${encodeURIComponent(baseUrl)}`;
    res.json({ success: true, inviteUrl, expiresAt: now + INVITE_TTL_MS, petCode: pet.petCode });
  });

  router.post('/agent/summon', (req, res) => {
    const pet = auth.database.getPetByOwnerUserId(req.userId);
    if (!pet) {
      return res.status(404).json({ success: false, error: '未找到宠物', code: 'PET_NOT_FOUND' });
    }
    const thread = auth.database.ensurePrivateThread(req.userId, pet.id);
    const messages = auth.database.getPrivateMessages(thread.id, 0, 100);
    res.json({ success: true, thread, pet, messages });
  });

  router.post('/private-chat/:threadId/messages', (req, res) => {
    const { threadId } = req.params;
    const { content } = req.body || {};
    const thread = auth.database.getPrivateThreadById(threadId);
    if (!thread || thread.ownerUserId !== req.userId) {
      return res.status(404).json({ success: false, error: '私聊线程不存在', code: 'THREAD_NOT_FOUND' });
    }
    if (typeof content !== 'string' || content.trim().length === 0 || content.length > 1000) {
      return res.status(400).json({ success: false, error: '消息长度必须在 1-1000', code: 'INVALID_MESSAGE' });
    }
    const message = {
      id: `pm_${uuidv4().slice(0, 8)}`,
      threadId,
      senderType: 'owner',
      senderUserId: req.userId,
      content: content.trim(),
      createdAt: Date.now(),
    };
    auth.database.addPrivateMessage(message);
    let publicDelivered = false;
    let warning = null;
    const pet = auth.database.getPetById(thread.petId);
    if (pet?.chatVisibility === 'public') {
      const publicResult = world.processChat(req.userId, `🐾 对${pet.petNickname}: ${content.trim()}`);
      publicDelivered = !!publicResult?.success;
      if (!publicDelivered) {
        warning = publicResult?.error || '公开消息发送失败';
      }
    }
    res.json({ success: true, message, publicDelivered, warning });
  });

  router.get('/private-chat/:threadId/messages', (req, res) => {
    const { threadId } = req.params;
    const since = Number(req.query.since || 0);
    const thread = auth.database.getPrivateThreadById(threadId);
    if (!thread || thread.ownerUserId !== req.userId) {
      return res.status(404).json({ success: false, error: '私聊线程不存在', code: 'THREAD_NOT_FOUND' });
    }
    const messages = auth.database.getPrivateMessages(threadId, Number.isFinite(since) ? since : 0, 100);
    res.json({ success: true, messages });
  });

  // ─── 管理员路由 ───────────────────────────────────
  router.get('/admin/users', auth.requireRole('admin'), (req, res) => {
    const users = auth.database.listAccounts(200);
    res.json({ success: true, users });
  });

  router.patch('/admin/users/:userId/role', auth.requireRole('admin'), (req, res) => {
    const { userId } = req.params;
    const { role } = req.body || {};
    if (role !== 'user' && role !== 'admin') {
      return res.status(400).json({
        success: false,
        error: 'role 必须是 user 或 admin',
        code: 'INVALID_ROLE',
      });
    }
    auth.database.updateAccountRole(userId, role);
    auth.database.addAdminAuditLog({
      id: `audit_${uuidv4().slice(0, 8)}`,
      adminUserId: req.userId,
      action: 'user_role_update',
      detail: JSON.stringify({ targetUserId: userId, role }),
      createdAt: Date.now(),
    });
    res.json({ success: true });
  });

  router.get('/admin/settings', auth.requireRole('admin'), (req, res) => {
    const settings = auth.database.getSystemSettings();
    res.json({ success: true, settings });
  });

  router.patch('/admin/settings', auth.requireRole('admin'), (req, res) => {
    const { key, value } = req.body || {};
    if (typeof key !== 'string' || key.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '设置 key 无效',
        code: 'INVALID_KEY',
      });
    }

    auth.database.upsertSystemSetting({
      key: key.trim(),
      value: String(value ?? ''),
      updatedBy: req.userId,
    });

    auth.database.addAdminAuditLog({
      id: `audit_${uuidv4().slice(0, 8)}`,
      adminUserId: req.userId,
      action: 'system_setting_update',
      detail: JSON.stringify({ key: key.trim(), value: String(value ?? '') }),
      createdAt: Date.now(),
    });

    res.json({ success: true });
  });

  // ─── Agent 接入路由（无需普通用户 token）────────────────────
  router.post('/agent/invites/consume', (req, res) => {
    const baseUrl = CONFIG.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const { code, agent_id } = req.body || {};
    if (!code) {
      return res.status(400).json({ success: false, error: '缺少 code', code: 'INVALID_PARAMS' });
    }

    // agent_id 不由 Agent/调用方自己生成：缺失时由服务端分配唯一标识。
    const assignedAgentId =
      typeof agent_id === 'string' && agent_id.trim().length > 0
        ? agent_id.trim()
        : `agent_${crypto.randomBytes(8).toString('hex')}`;

    const invite = auth.database.getAgentInviteByCodeHash(hashInviteCode(code));
    if (!invite) {
      return res.status(404).json({ success: false, error: '邀请码无效', code: 'INVITE_INVALID' });
    }
    if (Date.now() > invite.expiresAt) {
      return res.status(400).json({ success: false, error: '邀请码已过期', code: 'INVITE_EXPIRED' });
    }
    if (invite.usedCount >= invite.maxUses) {
      return res.status(400).json({ success: false, error: '邀请码已使用', code: 'INVITE_USED' });
    }

    const binding = {
      id: `bind_${uuidv4().slice(0, 8)}`,
      petId: invite.petId,
      ownerUserId: invite.ownerUserId,
      agentId: assignedAgentId,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    auth.database.upsertAgentBinding(binding);
    auth.database.consumeAgentInvite(invite.id);

    const token = `agt_${crypto.randomBytes(24).toString('hex')}`;
    auth.database.createAgentToken({
      token,
      ownerUserId: invite.ownerUserId,
      petId: invite.petId,
      agentId: assignedAgentId,
      expiresAt: Date.now() + AGENT_TOKEN_TTL_MS,
      createdAt: Date.now(),
    });

    const pet = auth.database.getPetById(invite.petId);
    res.json({
      success: true,
      agent_access_token: token,
      token_expires_in: AGENT_TOKEN_TTL_MS,
      agent_id: assignedAgentId,
      rest_endpoint: `${baseUrl}/api/agent`,
      mcp_endpoint: `${baseUrl}/mcp`,
      capabilities: ['private_chat.receive', 'private_chat.reply', 'world.look'],
      pet,
    });
  });

  const agentAuth = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: '需要 Agent Token', code: 'AUTH_REQUIRED' });
    }
    const token = authHeader.slice(7);
    const agentToken = auth.database.getAgentToken(token);
    if (!agentToken || Date.now() > agentToken.expiresAt) {
      return res.status(401).json({ success: false, error: 'Agent Token 无效或过期', code: 'AUTH_REQUIRED' });
    }
    req.agent = agentToken;
    next();
  };

  router.get('/agent/private-chat/inbox', agentAuth, (req, res) => {
    const thread = auth.database.ensurePrivateThread(req.agent.ownerUserId, req.agent.petId);
    const since = Number(req.query.since || 0);
    const messages = auth.database
      .getPrivateMessages(thread.id, Number.isFinite(since) ? since : 0, 100)
      .filter((msg) => msg.senderType === 'owner');
    res.json({ success: true, thread, messages });
  });

  router.post('/agent/private-chat/reply', agentAuth, (req, res) => {
    const { content } = req.body || {};
    if (typeof content !== 'string' || content.trim().length === 0 || content.length > 1000) {
      return res.status(400).json({ success: false, error: '消息长度必须在 1-1000', code: 'INVALID_MESSAGE' });
    }
    const thread = auth.database.ensurePrivateThread(req.agent.ownerUserId, req.agent.petId);
    const message = {
      id: `pm_${uuidv4().slice(0, 8)}`,
      threadId: thread.id,
      senderType: 'agent',
      senderUserId: req.agent.agentId,
      content: content.trim(),
      createdAt: Date.now(),
    };
    auth.database.addPrivateMessage(message);
    let publicDelivered = false;
    let warning = null;
    const pet = auth.database.getPetById(req.agent.petId);
    if (pet?.chatVisibility === 'public') {
      const publicResult = world.processChat(req.agent.ownerUserId, `🤖 ${pet.petNickname}: ${content.trim()}`);
      publicDelivered = !!publicResult?.success;
      if (!publicDelivered) {
        warning = publicResult?.error || '公开消息发送失败';
      }
    }
    res.json({ success: true, message, publicDelivered, warning });
  });

  return router;
}
