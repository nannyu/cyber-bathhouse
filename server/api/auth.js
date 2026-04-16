/**
 * Token 认证模块
 */

import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from '../config.js';

export class AuthManager {
  constructor() {
    /** @type {Map<string, Object>} token → { userId, name, type, createdAt } */
    this._tokens = new Map();

    /** @type {Map<string, string>} userId → token */
    this._userTokens = new Map();
  }

  /**
   * 注册新用户
   * @param {string} name
   * @param {string} type - 'browser' | 'agent'
   * @returns {{ success: boolean, token?: string, userId?: string, error?: string }}
   */
  register(name, type) {
    // 验证
    if (!name || name.length < CONFIG.NAME_MIN_LENGTH || name.length > CONFIG.NAME_MAX_LENGTH) {
      return {
        success: false,
        error: `昵称长度必须在 ${CONFIG.NAME_MIN_LENGTH}-${CONFIG.NAME_MAX_LENGTH} 字符之间`,
        code: 'INVALID_NAME',
      };
    }
    if (type !== 'browser' && type !== 'agent') {
      return {
        success: false,
        error: 'type 必须是 browser 或 agent',
        code: 'INVALID_TYPE',
      };
    }

    // 检查昵称是否重复
    for (const session of this._tokens.values()) {
      if (session.name === name) {
        return { success: false, error: '昵称已被占用', code: 'NAME_TAKEN' };
      }
    }

    const token = uuidv4();
    const userId = `usr_${uuidv4().slice(0, 8)}`;

    this._tokens.set(token, {
      userId,
      name,
      type,
      createdAt: Date.now(),
    });
    this._userTokens.set(userId, token);

    return { success: true, token, userId, name };
  }

  /**
   * 验证 Token
   * @param {string} token
   * @returns {{ valid: boolean, userId?: string, name?: string, type?: string }}
   */
  validate(token) {
    const session = this._tokens.get(token);
    if (!session) {
      return { valid: false };
    }

    // 检查过期
    if (Date.now() - session.createdAt > CONFIG.TOKEN_EXPIRY) {
      this._tokens.delete(token);
      this._userTokens.delete(session.userId);
      return { valid: false };
    }

    return {
      valid: true,
      userId: session.userId,
      name: session.name,
      type: session.type,
    };
  }

  /**
   * 通过 userId 获取 session 信息
   * @param {string} userId
   */
  getSessionByUserId(userId) {
    const token = this._userTokens.get(userId);
    if (!token) return null;
    return this._tokens.get(token);
  }

  /**
   * 移除用户 Token
   * @param {string} userId
   */
  removeByUserId(userId) {
    const token = this._userTokens.get(userId);
    if (token) {
      this._tokens.delete(token);
      this._userTokens.delete(userId);
    }
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
      next();
    };
  }
}
