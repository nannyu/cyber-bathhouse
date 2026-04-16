/**
 * 游戏主循环 — 管理渲染、场景、角色
 */

import { Bathhouse } from './Bathhouse.js';
import { drawCharacter, drawPet, drawBubble, drawHPBar, drawNameTag } from './SpriteRenderer.js';

export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    /** @type {Object|null} 当前世界状态 */
    this.worldState = null;

    /** @type {string|null} 当前用户 ID */
    this.myUserId = null;

    /** @type {Bathhouse} 澡堂场景 */
    this.bathhouse = new Bathhouse();

    /** @type {number} 动画帧计数器 */
    this._frameTick = 0;
    this._frame = 0;
    this._lastTime = 0;
    this._animationId = null;

    /** @type {Function|null} 点击回调 */
    this.onCanvasClick = null;

    // 绑定 Canvas 点击
    this.canvas.addEventListener('click', (e) => this._handleClick(e));

    // 自适应 Canvas 大小
    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(this.canvas.parentElement);
    this._resize();
  }

  _resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = parent.clientWidth * dpr;
    this.canvas.height = parent.clientHeight * dpr;
    this.canvas.style.width = parent.clientWidth + 'px';
    this.canvas.style.height = parent.clientHeight + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * 启动游戏循环
   */
  start() {
    this._lastTime = performance.now();
    const loop = (now) => {
      const dt = now - this._lastTime;
      this._lastTime = now;

      this._update(dt);
      this._render();

      this._animationId = requestAnimationFrame(loop);
    };
    this._animationId = requestAnimationFrame(loop);
  }

  /**
   * 停止游戏循环
   */
  stop() {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }

  /**
   * 更新世界状态（来自服务端）
   * @param {Object} state
   */
  updateState(state) {
    this.worldState = state;
  }

  // ─── 内部方法 ───────────────────────────────────────

  _update(dt) {
    // 帧动画
    this._frameTick += dt;
    if (this._frameTick >= 250) { // 4fps 帧切换
      this._frameTick = 0;
      this._frame++;
    }

    // 更新场景
    this.bathhouse.update(dt);
  }

  _render() {
    const ctx = this.ctx;
    const w = this.canvas.parentElement.clientWidth;
    const h = this.canvas.parentElement.clientHeight;

    // 清屏
    ctx.clearRect(0, 0, w, h);

    // 禁用抗锯齿（像素风）
    ctx.imageSmoothingEnabled = false;

    const state = this.worldState;
    if (!state) {
      this._renderLoading(ctx, w, h);
      return;
    }

    // 计算缩放
    const scaleX = w / state.width;
    const scaleY = h / state.height;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (w - state.width * scale) / 2;
    const offsetY = (h - state.height * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // 1. 渲染场景
    this.bathhouse.render(ctx, state.width, state.height, state.pool);

    // 2. 渲染角色（按 Y 排序实现深度感）
    const sortedUsers = [...(state.users || [])].sort((a, b) => a.y - b.y);

    for (const user of sortedUsers) {
      // 宠物（在角色下面层）
      if (user.pet) {
        drawPet(ctx, {
          x: user.pet.x,
          y: user.pet.y,
          type: user.pet.type,
          state: user.pet.state,
          frame: this._frame,
        });
      }

      // 角色
      drawCharacter(ctx, {
        x: user.x,
        y: user.y,
        palette: user.palette,
        state: user.state,
        frame: this._frame,
        direction: 1,
      });

      // 名字标签
      drawNameTag(ctx, {
        x: user.x + 24,
        y: user.y - 8,
        name: user.name,
        type: user.type,
      });

      // HP 条（战斗中或非满血显示）
      if (user.state === 'fighting' || user.hp < 100) {
        drawHPBar(ctx, {
          x: user.x + 24,
          y: user.y - 2,
          hp: user.hp,
          maxHp: 100,
        });
      }

      // 对话气泡
      if (user.bubble) {
        const opacity = Math.min(1, (user.bubbleTimer || 0) / 500);
        drawBubble(ctx, {
          x: user.x + 24,
          y: user.y - 14,
          text: user.bubble,
          opacity,
        });
      }
    }

    ctx.restore();
  }

  _renderLoading(ctx, w, h) {
    ctx.save();
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.fillStyle = '#00f0ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const dots = '.'.repeat((Math.floor(Date.now() / 500) % 3) + 1);
    ctx.fillText(`连接中${dots}`, w / 2, h / 2);
    ctx.restore();
  }

  _handleClick(e) {
    if (!this.worldState || !this.onCanvasClick) return;

    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const state = this.worldState;

    const scaleX = w / state.width;
    const scaleY = h / state.height;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (w - state.width * scale) / 2;
    const offsetY = (h - state.height * scale) / 2;

    // 屏幕坐标 → 世界坐标
    const worldX = (e.clientX - rect.left - offsetX) / scale;
    const worldY = (e.clientY - rect.top - offsetY) / scale;

    // 检查是否点击了角色
    let clickedUser = null;
    for (const user of (state.users || [])) {
      const dx = worldX - (user.x + 24);
      const dy = worldY - (user.y + 32);
      if (Math.abs(dx) < 30 && Math.abs(dy) < 40) {
        clickedUser = user;
        break;
      }
    }

    this.onCanvasClick({ worldX, worldY, clickedUser });
  }
}
