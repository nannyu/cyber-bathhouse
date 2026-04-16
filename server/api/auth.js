/**
 * Token 认证模块
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { CONFIG } from '../config.js';

export class AuthManager {
  constructor(database) {
    this.database = database;

    /** @type {Map<string, Array<number>>} 防机器人: IP -> timestamps */
    this._rateLimits = new Map();
  }

  /**
   * 注册新用户
   * @param {string} username
   * @param {string} password
   * @param {string} nickname
   * @param {string} type - 'browser' | 'agent'
   * @param {string} ip - 客户端 IP
   * @returns {{ success: boolean, token?: string, userId?: string, name?: string, error?: string }}
   */
  register(username, password, nickname, type, ip) {
    if (!username || username.length < 3 || username.length > 20) {
      return { success: false, error: '用户名必须在 3-20 字符之间', code: 'INVALID_USERNAME' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: '密码长度不能少于 6 位于', code: 'INVALID_PASSWORD' };
    }
    if (!nickname || nickname.length < CONFIG.NAME_MIN_LENGTH || nickname.length > CONFIG.NAME_MAX_LENGTH) {
      return { success: false, error: `昵称长度必须在 ${CONFIG.NAME_MIN_LENGTH}-${CONFIG.NAME_MAX_LENGTH} 字符之间`, code: 'INVALID_NICKNAME' };
    }

    // IP 频率限制 (防机器人)
    const now = Date.now();
    let history = this._rateLimits.get(ip) || [];
    history = history.filter(t => now - t < 60000); // 只保留最近 1 分钟
    if (history.length >= 3) {
      return { success: false, error: '注册过于频繁，请稍后再试', code: 'RATE_LIMIT' };
    }
    history.push(now);
    this._rateLimits.set(ip, history);

    if (this.database.getAccountByUsername(username)) {
      return { success: false, error: '该登录用户名已被占用', code: 'USERNAME_TAKEN' };
    }
    if (this.database.isNicknameTaken(nickname)) {
      return { success: false, error: '该昵称已被占用', code: 'NICKNAME_TAKEN' };
    }

    const userId = `usr_${uuidv4().slice(0, 8)}`;
    const passwordHash = bcrypt.hashSync(password, CONFIG.BCRYPT_ROUNDS);
    this.database.createAccount({
      username,
      password: passwordHash,
      nickname,
      userId,
      role: 'user',
    });
    this.database.createPetForOwner({
      id: `pet_${uuidv4().slice(0, 8)}`,
      ownerUserId: userId,
      petType: CONFIG.PET_TYPES[Math.floor(Math.random() * CONFIG.PET_TYPES.length)],
      petNickname: `${nickname}的宠物`,
    });

    // 注册后直接签发 Token
    return this._issueTokenSession(userId, nickname, type, 'user');
  }

  /**
   * 密码登录
   * @param {string} username
   * @param {string} password
   * @param {string} type - 'browser' | 'agent'
   */
  login(username, password, type) {
    const account = this.database.getAccountByUsername(username);
    if (!account) {
      return { success: false, error: '用户名或密码错误', code: 'AUTH_FAILED' };
    }

    let passwordMatched = false;
    const storedPassword = account.password;
    const isHash = typeof storedPassword === 'string' && storedPassword.startsWith('$2');

    if (isHash) {
      passwordMatched = bcrypt.compareSync(password, storedPassword);
    } else if (storedPassword === password) {
      passwordMatched = true;
      // 向后兼容：将历史明文密码升级为 bcrypt 哈希
      const upgradedHash = bcrypt.hashSync(password, CONFIG.BCRYPT_ROUNDS);
      this.database.updateAccountPassword(username, upgradedHash);
    }

    if (!passwordMatched) {
      return { success: false, error: '用户名或密码错误', code: 'AUTH_FAILED' };
    }

    return this._issueTokenSession(account.userId, account.nickname, type, account.role || 'user');
  }

  _issueTokenSession(userId, name, type, role) {
    // 若原先有 Token，可选择清理
    this.removeByUserId(userId);

    const token = uuidv4();
    this.database.saveSession({
      token,
      userId,
      name,
      type,
      role,
      createdAt: Date.now(),
    });

    return { success: true, token, userId, name, role };
  }

  /**
   * 验证 Token
   * @param {string} token
   * @returns {{ valid: boolean, userId?: string, name?: string, type?: string, role?: string }}
   */
  validate(token) {
    const session = this.database.getSessionByToken(token);
    if (!session) {
      return { valid: false };
    }

    // 检查过期
    if (Date.now() - session.createdAt > CONFIG.TOKEN_EXPIRY) {
      this.database.removeSessionByToken(token);
      return { valid: false };
    }

    return {
      valid: true,
      userId: session.userId,
      name: session.name,
      type: session.type,
      role: session.role || 'user',
    };
  }

  /**
   * 通过 userId 获取 session 信息
   * @param {string} userId
   */
  getSessionByUserId(userId) {
    return this.database.getSessionByUserId(userId);
  }

  /**
   * 移除用户 Token
   * @param {string} userId
   */
  removeByUserId(userId) {
    this.database.removeSessionByUserId(userId);
  }

  /**
   * Express 认证中间件
   */
  middleware() {
    return (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: '需要 Bearer Token 认证',
          code: 'AUTH_REQUIRED',
        });
      }

      const token = authHeader.slice(7);
      const result = this.validate(token);

      if (!result.valid) {
        return res.status(401).json({
          success: false,
          error: 'Token 无效或已过期',
          code: 'AUTH_REQUIRED',
        });
      }

      req.userId = result.userId;
      req.userName = result.name;
      req.userType = result.type;
      req.userRole = result.role;
      next();
    };
  }

  requireRole(role) {
    return (req, res, next) => {
      if (req.userRole !== role) {
        return res.status(403).json({
          success: false,
          error: '权限不足',
          code: 'FORBIDDEN',
        });
      }
      next();
    };
  }
}
