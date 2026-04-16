/**
 * 聊天系统
 */

import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from '../config.js';

export class ChatManager {
  constructor(database) {
    this.database = database;

    /** @type {Array<Object>} 消息历史 */
    this._messages = this.database.getRecentMessages(CONFIG.MESSAGE_HISTORY_SIZE);
  }

  /**
   * 添加消息
   * @param {string} userId - 发送者 ID
   * @param {string} name - 发送者昵称
   * @param {string} message - 消息内容
   * @returns {Object} 消息对象
   */
  addMessage(userId, name, message) {
    const msg = {
      id: `msg_${uuidv4().slice(0, 8)}`,
      userId,
      name,
      message: message.slice(0, CONFIG.MESSAGE_MAX_LENGTH),
      timestamp: Date.now(),
    };

    this._messages.push(msg);
    this.database.saveMessage(msg);

    // 保留最近 N 条
    if (this._messages.length > CONFIG.MESSAGE_HISTORY_SIZE) {
      this._messages.shift();
    }
    this.database.trimMessages(CONFIG.MESSAGE_HISTORY_SIZE);

    return msg;
  }

  /**
   * 获取最近消息
   * @param {number} [count=50] - 返回数量
   * @returns {Array<Object>}
   */
  getRecentMessages(count = 50) {
    return this._messages.slice(-count);
  }

  /**
   * 获取所有消息
   * @returns {Array<Object>}
   */
  getAllMessages() {
    return [...this._messages];
  }
}
