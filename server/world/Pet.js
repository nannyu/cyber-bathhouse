/**
 * AI 宠物实体
 */

import { CONFIG } from '../config.js';

export class Pet {
  /**
   * @param {string} type - 宠物类型
   * @param {number} ownerX - 主人 X 坐标
   * @param {number} ownerY - 主人 Y 坐标
   */
  constructor(type, ownerX, ownerY) {
    this.type = type;
    this.x = ownerX + 8 + Math.random() * 16;
    this.y = ownerY + 5 + Math.random() * 10;
    this.state = 'follow'; // follow | stay | trick | greet
    this._trickTimer = 0;
    this._greetTimer = 0;
  }

  /**
   * 每帧更新
   * @param {number} dt - 帧间隔（毫秒）
   * @param {number} ownerX - 主人 X
   * @param {number} ownerY - 主人 Y
   */
  update(dt, ownerX, ownerY) {
    // 特技计时器
    if (this.state === 'trick') {
      this._trickTimer -= dt;
      if (this._trickTimer <= 0) {
        this.state = 'follow';
      }
      return;
    }

    // 打招呼计时器
    if (this.state === 'greet') {
      this._greetTimer -= dt;
      if (this._greetTimer <= 0) {
        this.state = 'follow';
      }
      return;
    }

    // 跟随主人
    if (this.state === 'follow') {
      const targetX = ownerX + 12;
      const targetY = ownerY + 8;
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > CONFIG.PET_FOLLOW_DISTANCE) {
        const speed = CONFIG.PET_FOLLOW_SPEED * (dt / 1000);
        const ratio = Math.min(speed / dist, 1);
        this.x += dx * ratio;
        this.y += dy * ratio;
      }
    }
    // stay 状态：不移动
  }

  /**
   * 执行特技
   */
  doTrick() {
    this.state = 'trick';
    this._trickTimer = 2000; // 2 秒特技动画
  }

  /**
   * 向最近用户打招呼
   */
  doGreet() {
    this.state = 'greet';
    this._greetTimer = 1500;
  }

  /**
   * 序列化
   */
  toJSON() {
    return {
      type: this.type,
      x: Math.round(this.x),
      y: Math.round(this.y),
      state: this.state,
    };
  }
}
