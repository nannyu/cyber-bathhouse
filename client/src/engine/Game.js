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

    /** @type {Array<Object>} 战斗飘字 */
    this.floatingTexts = [];

    /** @type {Map<string, number>} 胜利跳跃动画 */
    this.victoryTimers = new Map();

    /** @type {Map<string, number>} 失败倒地动画 */
    this.defeatedTimers = new Map();

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

  handleFightHit(data) {
    if (!this.worldState?.users) return;
    const attacker = this.worldState.users.find(u => u.name === data.attackerName);
    const defender = this.worldState.users.find(u => u.name === data.defenderName);

    if (defender && data.attackerDamage > 0) {
      this.addDamageText(defender.x + 24, defender.y - 10, data.attackerDamage);
    }
    if (attacker && data.counterDamage > 0) {
      this.addDamageText(attacker.x + 24, attacker.y - 10, data.counterDamage);
    }
  }

  handleFightEnded(data) {
    if (data.winnerName) {
      this.victoryTimers.set(data.winnerName, 3000);
    }
    if (data.loserName) {
      this.defeatedTimers.set(data.loserName, 3000);
    }
  }

  addDamageText(x, y, damage) {
    this.floatingTexts.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y,
      text: `-${damage}`,
      color: '#ff2d78',
      life: 1500,
    });
  }

  // ─── 内部方法 ───────────────────────────────────────

  _update(dt) {
    // 帧动画
    this._frameTick += dt;
    if (this._frameTick >= 250) { // 4fps 帧切换
      this._frameTick = 0;
      this._frame++;
    }

    // 场景
    this.bathhouse.update(dt);

    // 飘字动画
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y -= 25 * (dt / 1000);
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // 胜利/失败计时器
    for (const [name, time] of this.victoryTimers.entries()) {
      if (time - dt <= 0) this.victoryTimers.delete(name);
      else this.victoryTimers.set(name, time - dt);
    }
    for (const [name, time] of this.defeatedTimers.entries()) {
      if (time - dt <= 0) this.defeatedTimers.delete(name);
      else this.defeatedTimers.set(name, time - dt);
    }
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
    this.bathhouse.render(ctx, state.width, state.height, state.pool, state.zones, state.scrubBeds);

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

      // 判断是否胜利中
      let drawState = user.state;
      if (this.victoryTimers.has(user.name)) {
        drawState = 'victory';
      }

      // 角色
      let spriteState = drawState;
      if (this.defeatedTimers.has(user.name)) {
        spriteState = 'defeated';
      }

      drawCharacter(ctx, {
        x: user.x,
        y: user.y,
        palette: user.palette,
        state: spriteState,
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

    // 3. 渲染被击中的飘血文字
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, ft.life / 1500);
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 12px "Press Start 2P", monospace';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;

    // 4. 渲染顶部的排行榜
    this._renderLeaderboard(ctx, state.width, state.leaderboard);

    ctx.restore();
  }

  _renderLeaderboard(ctx, worldWidth, leaderboard) {
    if (!leaderboard || leaderboard.length === 0) return;

    ctx.save();
    const top3 = leaderboard.slice(0, 3);
    const boxWidth = 140;
    const boxHeight = 16 + top3.length * 12;
    const bx = worldWidth - boxWidth - 10;
    const by = 10;

    ctx.fillStyle = 'rgba(0, 20, 40, 0.7)';
    ctx.strokeStyle = '#00f0ff';
    ctx.fillRect(bx, by, boxWidth, boxHeight);
    ctx.strokeRect(bx, by, boxWidth, boxHeight);

    ctx.fillStyle = '#ffcc00';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 胜场排行', bx + boxWidth / 2, by + 12);

    ctx.fillStyle = '#fff';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    top3.forEach((entry, idx) => {
      ctx.fillText(`${idx + 1}.${entry.name}`, bx + 10, by + 26 + idx * 12);
      ctx.fillText(`${entry.wins}胜`, bx + boxWidth - 30, by + 26 + idx * 12);
    });

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
    let clickedPetOwner = null;
    for (const user of (state.users || [])) {
      if (!user.pet) continue;
      const pdx = worldX - user.pet.x;
      const pdy = worldY - user.pet.y;
      if (Math.abs(pdx) < 22 && Math.abs(pdy) < 22) {
        clickedPetOwner = user;
        break;
      }
    }

    // 宠物优先于人物点击
    if (!clickedPetOwner) {
      for (const user of (state.users || [])) {
        const dx = worldX - (user.x + 24);
        const dy = worldY - (user.y + 32);
        if (Math.abs(dx) < 30 && Math.abs(dy) < 40) {
          clickedUser = user;
          break;
        }
      }
    }
    this.onCanvasClick({ worldX, worldY, clickedUser, clickedPetOwner });
  }
}
