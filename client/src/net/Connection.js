/**
 * Socket.IO 客户端封装
 */

import { io } from 'socket.io-client';

export class Connection {
  constructor() {
    /** @type {import('socket.io-client').Socket|null} */
    this.socket = null;
    this.token = null;
    this.userId = null;
    this.userName = null;
    this.userRole = 'user';
    this._listeners = new Map();
  }

  // 辅助获取 Cookie
  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  /**
   * 检查本地是否已有 Cookie 可自动登录
   */
  async tryAutoLogin() {
    const t = this.getCookie('auth_token');
    if (!t) return false;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${t}` }
      });
      const data = await res.json();
      if (data.success) {
        this.token = t;
        this.userId = data.userId;
        this.userName = data.name;
        this.userRole = data.role || 'user';
        return true;
      }
    } catch(e) {
      // 忽略网络或验证错误
    }
    return false;
  }

  /**
   * 注册并获取 Token
   * @param {string} username
   * @param {string} password
   * @param {string} nickname
   * @returns {Promise<Object>}
   */
  async register(username, password, nickname) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, nickname, type: 'browser' }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    this.token = data.token;
    this.userId = data.userId;
    this.userName = data.name;
    this.userRole = data.role || 'user';
    return data;
  }

  /**
   * 登录
   * @param {string} username
   * @param {string} password
   * @returns {Promise<Object>}
   */
  async login(username, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, type: 'browser' }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    this.token = data.token;
    this.userId = data.userId;
    this.userName = data.name; // nickname
    this.userRole = data.role || 'user';
    return data;
  }

  /**
   * 连接 WebSocket
   */
  connect() {
    if (!this.token) throw new Error('未注册');

    this.socket = io({
      auth: { token: this.token },
    });

    this.socket.on('connect', () => {
      this._emit('connected');
    });

    this.socket.on('disconnect', () => {
      this._emit('disconnected');
    });

    this.socket.on('connect_error', (err) => {
      this._emit('error', err.message);
    });

    // 世界状态事件
    this.socket.on('world:state', (state) => this._emit('world:state', state));
    this.socket.on('world:update', (state) => this._emit('world:update', state));
    this.socket.on('chat:message', (msg) => this._emit('chat:message', msg));
    this.socket.on('user:joined', (user) => this._emit('user:joined', user));
    this.socket.on('user:left', (data) => this._emit('user:left', data));
    this.socket.on('fight:started', (data) => this._emit('fight:started', data));
    this.socket.on('fight:hit', (data) => this._emit('fight:hit', data));
    this.socket.on('fight:ended', (data) => this._emit('fight:ended', data));
  }

  /**
   * 加入澡堂
   * @param {string} petType
   */
  async join(petType) {
    const res = await fetch('/api/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({ pet_type: petType }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    // 通知 WebSocket
    this.socket?.emit('join', { pet_type: petType });
    return data;
  }

  /**
   * 发送聊天消息
   * @param {string} message
   */
  sendChat(message) {
    this.socket?.emit('chat', { message });
  }

  /**
   * 移动角色
   * @param {number} x
   * @param {number} y
   */
  sendMove(x, y) {
    this.socket?.emit('move', { x, y });
  }

  /**
   * 发送动作
   * @param {string} type
   * @param {Object} params
   */
  sendAction(type, params = {}) {
    this.socket?.emit('action', { type, ...params });
  }

  async summonPetChat() {
    const res = await fetch('/api/agent/summon', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '召唤失败');
    return data;
  }

  async sendPrivateMessage(threadId, content) {
    const res = await fetch(`/api/private-chat/${encodeURIComponent(threadId)}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '发送失败');
    return data;
  }

  async fetchPrivateMessages(threadId, since = 0) {
    const res = await fetch(`/api/private-chat/${encodeURIComponent(threadId)}/messages?since=${since}`, {
      headers: { 'Authorization': `Bearer ${this.token}` },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '拉取消息失败');
    return data.messages || [];
  }

  async getPetProfile() {
    const res = await fetch('/api/pets/me', {
      headers: { 'Authorization': `Bearer ${this.token}` },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '获取宠物失败');
    return data.pet;
  }

  async updatePetSettings(petId, petNickname, chatVisibility) {
    const res = await fetch(`/api/pets/${encodeURIComponent(petId)}/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({ pet_nickname: petNickname, chat_visibility: chatVisibility }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '更新失败');
    return data.pet;
  }

  async createAgentInvite() {
    const res = await fetch('/api/agent/invites', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '生成邀请失败');
    return data;
  }

  async getAdminUsers() {
    const res = await fetch('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${this.token}` },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '读取用户失败');
    return data.users || [];
  }

  async updateUserRole(userId, role) {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '更新角色失败');
  }

  async getAdminSettings() {
    const res = await fetch('/api/admin/settings', {
      headers: { 'Authorization': `Bearer ${this.token}` },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '读取配置失败');
    return data.settings || [];
  }

  async updateAdminSetting(key, value) {
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({ key, value }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '更新配置失败');
  }

  /**
   * 事件监听
   * @param {string} event
   * @param {Function} fn
   */
  on(event, fn) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(fn);
  }

  _emit(event, data) {
    const fns = this._listeners.get(event);
    if (fns) fns.forEach(fn => fn(data));
  }
}
