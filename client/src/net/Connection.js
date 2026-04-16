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
    this._listeners = new Map();
  }

  /**
   * 注册并获取 Token
   * @param {string} name
   * @returns {Promise<Object>}
   */
  async register(name) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type: 'browser' }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    this.token = data.token;
    this.userId = data.userId;
    this.userName = data.name;
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
