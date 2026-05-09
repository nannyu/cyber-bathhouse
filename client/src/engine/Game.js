/**
 * 游戏主循环 — 管理渲染、场景、角色
 */

import { Bathhouse } from './Bathhouse.js';
import {
  drawCharacter,
  drawPet,
  drawBubble,
  drawHPBar,
  drawNameTag,
  KO_DOWN_DURATION_MS,
} from './SpriteRenderer.js';
import { EffectsLayer } from './EffectsLayer.js';
import { getSpriteAtlas } from './SpriteAtlas.js';

const FALLBACK_ATTACK_LINES = [
  '看我猴子偷桃！',
  '吃我一记回旋踢！',
  '让你见识下铁头功！',
  '闪电五连击！',
  '这一拳很有力度！',
];

const FALLBACK_COUNTER_LINES = [
  '别得意，接招！',
  '反手就是一记重击！',
  '来而不往非礼也！',
  '我可不会站着挨打！',
  '吃我一招回马枪！',
];

function pickCombatLine(combatLinePools, petType, kind) {
  const styleLines = combatLinePools?.[petType]?.[kind];
  const pool = Array.isArray(styleLines) && styleLines.length > 0
    ? styleLines
    : (kind === 'attack' ? FALLBACK_ATTACK_LINES : FALLBACK_COUNTER_LINES);
  return pool[Math.floor(Math.random() * pool.length)];
}

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
    /** @type {Map<string, { text: string, life: number }>} 战斗出招气泡 */
    this.combatBubbles = new Map();
    /** @type {Map<string, Object>} 战斗快照 */
    this.fightSnapshots = new Map();
    /** @type {{ text: string, life: number, maxLife: number } | null} 必杀技横幅 */
    this.ultimateBanner = null;
    /** @type {{ label: string, seconds: number, life: number, maxLife: number, big: boolean } | null} 倒计时横幅 */
    this.countdownBanner = null;
    this.screenShake = 0;
    this.effectsLayer = new EffectsLayer();
    /** @type {Record<string, {attack: string[], counter: string[]}>} 宠物战斗台词池 */
    this.combatLinePools = {};

    /** @type {Map<string, number>} 胜利跳跃动画 */
    this.victoryTimers = new Map();

    /** @type {Map<string, number>} 失败倒地动画 */
    this.defeatedTimers = new Map();

    /** 慢动作效果（KO 时触发） */
    this._slowMotionFactor = 1;    // 1 = 正常速度, 0.1 = 极慢
    this._slowMotionTimer = 0;     // 剩余慢动作时间 (ms, 真实时间)
    this._slowMotionDuration = 0;  // 总慢动作时长
    this._koFlash = 0;             // KO 白屏闪烁
    this._koBanner = null;         // KO 横幅

    /** @type {Map<string, {x: number, y: number}>} 上一帧角色位置（用于检测移动） */
    this._lastPositions = new Map();

    /** @type {number} 动画帧计数器 */
    this._frameTick = 0;
    this._frame = 0;
    this._lastTime = 0;
    this._animationId = null;
    this.spriteAtlas = getSpriteAtlas();
    this.spriteAtlas.loadManifest();
    this._preloadedSprites = new Set();

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
      const realDt = now - this._lastTime;
      this._lastTime = now;
      let dt = realDt;

      // KO 慢动作处理（用真实 dt 衰减计时器，用缩放后的 dt 更新游戏）
      if (this._slowMotionTimer > 0) {
        this._slowMotionTimer -= realDt;
        // 慢动作因子随时间逐渐恢复到 1（二次缓出）
        const progress = 1 - Math.max(0, this._slowMotionTimer) / this._slowMotionDuration;
        const easedFactor = this._slowMotionFactor + (1 - this._slowMotionFactor) * (progress * progress);
        dt = realDt * easedFactor;
        if (this._slowMotionTimer <= 0) {
          this._slowMotionFactor = 1;
        }
      }

      // KO 白屏闪烁衰减
      if (this._koFlash > 0) {
        this._koFlash -= realDt;
        if (this._koFlash < 0) this._koFlash = 0;
      }

      // KO 横幅衰减
      if (this._koBanner) {
        this._koBanner.life -= realDt;
        if (this._koBanner.life <= 0) this._koBanner = null;
      }

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

  /**
   * 由后端数据库加载宠物战斗台词池
   * @param {Record<string, {attack?: string[], counter?: string[]}>} pools
   */
  setCombatLinePools(pools) {
    this.combatLinePools = pools || {};
  }

  /**
   * 注入音乐能量用于场景联动
   * @param {number} value
   */
  setMusicReactiveLevel(value) {
    this.bathhouse.setMusicEnergy(value);
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
    if (attacker) {
      const text = pickCombatLine(this.combatLinePools, attacker.pet?.type, 'attack');
      this.combatBubbles.set(attacker.name, { text, life: 1200 });
      data._attackLine = text;
    }
    if (defender) {
      const text = pickCombatLine(this.combatLinePools, defender.pet?.type, 'counter');
      this.combatBubbles.set(defender.name, { text, life: 1200 });
      data._counterLine = text;
    }
    return {
      attackLine: data._attackLine || '看招！',
      counterLine: data._counterLine || '接招！',
    };
  }

  handleFightSnapshot(data) {
    if (data?.id) {
      this.fightSnapshots.set(data.id, data);
      // queue/walk_in 时 Match 内 facing 仍是「左 1 右 -1」占位，每帧写入会覆盖走位朝向 → 倒着走
      const syncFacingFromFight = data.phase === 'countdown' || data.phase === 'active';
      for (const fighter of data.fighters || []) {
        const user = this.worldState?.users?.find((u) => u.id === fighter.userId);
        // 避免战后残留快照写回已离场选手；animKey 否则会一直卡在受击序列
        if (!user || user.fightId !== data.id) continue;
        user.actionState = fighter.actionState || user.actionState;
        user.currentSkillId = fighter.currentSkillId || fighter.currentAction?.skillId || null;
        user.phase = fighter.phase || fighter.currentAction?.phase || null;
        user.phaseFrame = fighter.phaseFrame ?? fighter.currentAction?.frame ?? 0;
        user.vx = fighter.vx || 0;
        if (syncFacingFromFight && (fighter.facing === 1 || fighter.facing === -1)) {
          user.facing = fighter.facing;
        }
      }
      for (const p of data.projectiles || []) {
        this.effectsLayer.addProjectileTrail(p.x, p.y);
      }
    }
  }

  handleFightEvent(event) {
    const payload = event?.payload || {};
    switch (event?.type) {
      case 'ultimate:cast':
        this.ultimateBanner = {
          text: payload.ultimateId === 'steam_reversal' ? 'STEAM REVERSAL' : 'NEON OVERDRIVE',
          life: 1600,
          maxLife: 1600,
        };
        this.screenShake = Math.max(this.screenShake, 14);
        break;
      case 'ultimate:hit':
        this.addDamageText(payload.targetX || 400, payload.targetY || 260, payload.damage || 0, '#ffe66d');
        this.effectsLayer.addHitSpark(payload.hitX || payload.targetX || 400, payload.hitY || payload.targetY || 260, 'cinematic');
        this.screenShake = Math.max(this.screenShake, 18);
        break;
      case 'skill:hit':
      case 'projectile:hit':
        this.effectsLayer.addHitSpark(payload.hitX || payload.x || 400, payload.hitY || payload.y || 260, payload.hitSpark || 'small');
        break;
      case 'ultimate:ready':
        this.ultimateBanner = {
          text: 'RAGE MAX',
          life: 900,
          maxLife: 900,
        };
        break;
      default:
        break;
    }
  }

  showCountdown(label, seconds, big = false) {
    const isFight = (label || '').toUpperCase().startsWith('FIGHT');
    this.countdownBanner = {
      label: label ?? String(seconds),
      seconds,
      life: isFight ? 1200 : 950,
      maxLife: isFight ? 1200 : 950,
      big: !!big || isFight,
    };
  }

  handleFightEnded(data) {
    const users = this.worldState?.users;
    if (users?.length) {
      for (const u of users) {
        const hit =
          (data.winnerId && u.id === data.winnerId)
          || (data.loserId && u.id === data.loserId)
          || (data.winnerName && u.name === data.winnerName)
          || (data.loserName && u.name === data.loserName);
        if (!hit) continue;
        u.actionState = 'idle';
        u.currentSkillId = null;
        u.phase = null;
        u.phaseFrame = 0;
        u.vx = 0;
      }
    }
    if (data.fightId) this.fightSnapshots.delete(data.fightId);

    if (data.isDraw) {
      return;
    }
    if (data.winnerName) {
      this.victoryTimers.set(data.winnerName, 3000);
    }
    if (data.loserName) {
      this.defeatedTimers.set(data.loserName, KO_DOWN_DURATION_MS);

      // 触发 KO 慢动作 + 特效（拳皇风格）
      this._slowMotionFactor = 0.15;       // 极慢
      this._slowMotionTimer = 1200;        // 持续 1.2 秒真实时间
      this._slowMotionDuration = 1200;
      this.screenShake = Math.max(this.screenShake, 20);
      this._koBanner = { life: 2500, maxLife: 2500 };
    }
  }

  addDamageText(x, y, damage, color = '#ff2d78') {
    this.floatingTexts.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y,
      text: `-${damage}`,
      color,
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
    for (const [name, bubble] of this.combatBubbles.entries()) {
      bubble.life -= dt;
      if (bubble.life <= 0) {
        this.combatBubbles.delete(name);
      }
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

    if (this.ultimateBanner) {
      this.ultimateBanner.life -= dt;
      if (this.ultimateBanner.life <= 0) {
        this.ultimateBanner = null;
      }
    }
    if (this.countdownBanner) {
      this.countdownBanner.life -= dt;
      if (this.countdownBanner.life <= 0) {
        this.countdownBanner = null;
      }
    }
    this.screenShake = Math.max(0, this.screenShake - dt * 0.04);
    this.effectsLayer.update(dt);

    // 搓澡粒子效果 — 为正在搓澡的角色生成粒子
    if (this.worldState?.users) {
      for (const user of this.worldState.users) {
        if (user.state === 'scrubbing' && user.scrubTimer > 0) {
          // 每帧有概率生成粒子
          if (Math.random() < 0.3) {
            this.effectsLayer.addScrubParticle(user.x + 24, user.y + 16);
          }
        }
      }
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
    if (this.screenShake > 0) {
      const shake = this.screenShake / Math.max(scale, 0.001);
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    // 1. 渲染场景
    this.bathhouse.render(ctx, state.width, state.height, state.pool, state.zones, state.scrubBeds);

    // 2. 渲染角色（按 Y 排序实现深度感）
    const sortedUsers = [...(state.users || [])].sort((a, b) => a.y - b.y);

    // 仅在倒计时 / 正式开打时朝向对手。queue、walk_in 时双方常在横向走位，
    // 若仍按对手方位覆盖 facing，会出现面朝对手却往反方向移动（像倒着走）。
    const FACING_BY_OPPONENT_PHASES = new Set(['countdown', 'active']);
    const opponentByUserId = new Map();
    for (const fight of state.fights || []) {
      if (!fight || fight.finished) continue;
      if (!FACING_BY_OPPONENT_PHASES.has(fight.phase)) continue;
      const aId = fight.attacker?.id;
      const bId = fight.defender?.id;
      if (aId && bId) {
        opponentByUserId.set(aId, bId);
        opponentByUserId.set(bId, aId);
      }
    }
    const userById = new Map(sortedUsers.map((u) => [u.id, u]));
    for (const user of sortedUsers) {
      const oppId = opponentByUserId.get(user.id);
      if (!oppId) continue;
      const opp = userById.get(oppId);
      if (!opp) continue;
      const rdx = (opp.x ?? 0) - (user.x ?? 0);
      if (Math.abs(rdx) > 0.5) {
        user.facing = rdx > 0 ? 1 : -1;
      }
    }

    for (const user of sortedUsers) {
      if (user.spriteId && !this._preloadedSprites.has(user.spriteId)) {
        this._preloadedSprites.add(user.spriteId);
        this.spriteAtlas.preload(user.spriteId).catch(() => { });
      }
      // 宠物（在角色下面层）
      if (user.pet) {
        drawPet(ctx, {
          x: user.pet.x,
          y: user.pet.y,
          type: user.pet.type,
          state: user.pet.state,
          frame: this._frame,
        });
        // 宠物加油气泡
        if (user.pet.cheerBubble && user.pet.cheerBubbleTimer > 0) {
          const opacity = Math.min(1, user.pet.cheerBubbleTimer / 500);
          drawBubble(ctx, {
            x: user.pet.x,
            y: user.pet.y - 12,
            text: user.pet.cheerBubble,
            opacity,
          });
        }
      }

      // 判断是否胜利中
      let drawState = user.state;
      if (this.victoryTimers.has(user.name)) {
        drawState = 'victory';
      }

      // 检测角色是否在移动（通过对比上一帧位置）
      const lastPos = this._lastPositions.get(user.id);
      const dx = lastPos ? user.x - lastPos.x : 0;
      const dy = lastPos ? user.y - lastPos.y : 0;
      const isMoving = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;
      this._lastPositions.set(user.id, { x: user.x, y: user.y });

      // 战斗中正在移动 → 显示行走动画（让移动可见）
      if (drawState === 'fighting' && isMoving) {
        drawState = 'walking';
      }
      // 候场 / 走入场地 → 走路或站立动画（不要让 SpriteRenderer 走出招分支）
      if (drawState === 'walking_to_arena') {
        drawState = isMoving ? 'walking' : 'idle';
      } else if (drawState === 'awaiting_fight') {
        drawState = isMoving ? 'walking' : 'idle';
      }

      // 角色
      let spriteState = drawState;
      if (this.defeatedTimers.has(user.name)) {
        spriteState = 'defeated';
      }

      const drawFacing = user.facing === -1 ? -1 : 1;

      const inCombatFlow =
        user.state === 'fighting'
        || user.state === 'awaiting_fight'
        || user.state === 'walking_to_arena';

      const isKoRecover = this.defeatedTimers.has(user.name);
      const koElapsedMs = isKoRecover
        ? (KO_DOWN_DURATION_MS - (this.defeatedTimers.get(user.name) ?? 0))
        : undefined;

      let poseActionState = null;
      let poseSkillId = null;
      let posePhase = null;
      let posePhaseFrame = 0;
      if (isKoRecover) {
        poseActionState = 'knockdown';
      } else if (inCombatFlow) {
        poseActionState = user.actionState;
        poseSkillId = user.currentSkillId;
        posePhase = user.phase;
        posePhaseFrame = user.phaseFrame ?? 0;
      }

      // 地面椭圆投影（阴影）— y+32 是精灵表锚点脚底位置
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(user.x + 24, user.y + 32, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawCharacter(ctx, {
        x: user.x,
        y: user.y,
        palette: user.palette,
        state: spriteState,
        frame: this._frame,
        direction: drawFacing < 0 ? 3 : 1,
        actionState: poseActionState,
        currentSkillId: poseSkillId,
        phase: posePhase,
        phaseFrame: posePhaseFrame,
        knockdownElapsedMs: koElapsedMs,
        spriteId: user.spriteId,
        facing: drawFacing,
      });
      if (inCombatFlow && user.actionState === 'dash') {
        this.effectsLayer.addAfterImage(user.x + 24, user.y + 32);
      }

      // 名字标签
      drawNameTag(ctx, {
        x: user.x + 24,
        y: user.y - 18,
        name: user.name,
        type: user.type,
        isNpc: user.id?.startsWith('npc_'),
      });

      // HP 条（非满血且不在战斗中时显示，战斗中由底部 HUD 显示）
      if (user.hp < 100 && user.state !== 'fighting') {
        drawHPBar(ctx, {
          x: user.x + 24,
          y: user.y - 2,
          hp: user.hp,
          maxHp: 100,
        });
      }

      // 搓澡进度条（仅在搓澡状态且不在战斗中时显示）
      if (user.state === 'scrubbing' && user.scrubTimer > 0 && !user.fightId) {
        const barWidth = 40;
        const barHeight = 4;
        const barX = user.x + 24 - barWidth / 2;
        const barY = user.y - 6;
        const maxDuration = 8000;
        const progress = 1 - (user.scrubTimer / maxDuration);

        // 背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        // 进度（绿色渐变）
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(barX, barY, barWidth * progress, barHeight);
        // 边框
        ctx.strokeStyle = '#166534';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        // 搓澡图标
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText('🧖 搓澡中', user.x + 24, barY - 2);

        // 搓澡动作线（来回摆动的弧线表示搓澡动作）
        const t = Date.now() * 0.008;
        ctx.strokeStyle = 'rgba(255, 200, 100, 0.6)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          const offsetX = Math.sin(t + i * 2) * 12;
          const lineY = user.y + 20 + i * 8;
          ctx.beginPath();
          ctx.moveTo(user.x + 10 + offsetX, lineY);
          ctx.lineTo(user.x + 38 + offsetX, lineY);
          ctx.stroke();
        }
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
      const combatBubble = this.combatBubbles.get(user.name);
      if (combatBubble) {
        const opacity = Math.min(1, combatBubble.life / 350);
        drawBubble(ctx, {
          x: user.x + 24,
          y: user.y - 36,
          text: combatBubble.text,
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

    // 4. 渲染底部的战斗 HUD（最后绘制，确保在最顶层）
    this._renderCombatHud(ctx, state);
    this.effectsLayer.render(ctx);
    this._renderUltimateBanner(ctx, state.width, state.height);
    this._renderCountdownBanner(ctx, state.width, state.height);
    this._renderKoEffect(ctx, state.width, state.height);
    // this._renderLeaderboard(ctx, state.width, state.leaderboard); // 已迁移至前端 DOM

    ctx.restore();
  }

  _renderCombatHud(ctx, state) {
    const fights = state.fights || [];
    if (fights.length === 0) return;

    const fight = fights[0];
    const users = state.users || [];
    const left = users.find((u) => u.id === fight.attacker.id);
    const right = users.find((u) => u.id === fight.defender.id);
    if (!left || !right) return;

    // 底部 HUD 位置（Canvas 高 768，HUD 高 50，留 10px 边距）
    const hudY = state.height - 60;

    ctx.save();
    this._renderFighterHud(ctx, {
      x: 14,
      y: hudY,
      width: 260,
      name: left.name,
      hp: left.hp,
      rage: left.rage || 0,
      align: 'left',
      palette: left.palette,
    });
    this._renderFighterHud(ctx, {
      x: state.width - 274,
      y: hudY,
      width: 260,
      name: right.name,
      hp: right.hp,
      rage: right.rage || 0,
      align: 'right',
      palette: right.palette,
    });

    // FIGHT 标志放底部中央 + 倒计时
    ctx.fillStyle = 'rgba(0, 20, 40, 0.82)';
    ctx.strokeStyle = '#ff2d78';
    ctx.lineWidth = 1;
    ctx.fillRect(state.width / 2 - 46, hudY, 92, 28);
    ctx.strokeRect(state.width / 2 - 46, hudY, 92, 28);
    ctx.fillStyle = '#ffe66d';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';

    // 从 fight snapshot 获取剩余时间
    const snapshot = this.fightSnapshots.get(fight.id);
    const remainingFrames = snapshot?.roundRemainingFrames;
    if (remainingFrames != null && remainingFrames >= 0) {
      const remainingSec = Math.ceil(remainingFrames / 20); // 20Hz tick rate
      // 倒计时颜色：<10秒变红闪烁
      if (remainingSec <= 10) {
        ctx.fillStyle = this._frame % 4 < 2 ? '#ff2d78' : '#ffe66d';
      }
      ctx.fillText(`${remainingSec}s`, state.width / 2, hudY + 18);
    } else {
      ctx.fillText('FIGHT', state.width / 2, hudY + 18);
    }

    ctx.restore();
  }

  _renderFighterHud(ctx, { x, y, width, name, hp, rage, align, palette }) {
    const hpRatio = Math.max(0, Math.min(1, hp / 100));
    const rageRatio = Math.max(0, Math.min(1, rage / 100));
    const barX = x + 8;
    const barW = width - 16;

    ctx.fillStyle = 'rgba(0, 14, 30, 0.84)';
    ctx.strokeStyle = rage >= 100 ? '#ffe66d' : '#00f0ff';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, width, 50);
    ctx.strokeRect(x, y, width, 50);

    ctx.fillStyle = palette?.hair || '#fff';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = align;
    ctx.fillText(name, align === 'left' ? barX : barX + barW, y + 13);

    ctx.fillStyle = '#1c2230';
    ctx.fillRect(barX, y + 20, barW, 9);
    ctx.fillStyle = hpRatio > 0.35 ? '#39ff14' : '#ff2d78';
    const hpWidth = Math.round(barW * hpRatio);
    if (align === 'left') ctx.fillRect(barX, y + 20, hpWidth, 9);
    else ctx.fillRect(barX + barW - hpWidth, y + 20, hpWidth, 9);

    ctx.fillStyle = '#1c2230';
    ctx.fillRect(barX, y + 34, barW, 6);
    ctx.fillStyle = rage >= 100 ? '#ffe66d' : '#b829dd';
    const rageWidth = Math.round(barW * rageRatio);
    if (align === 'left') ctx.fillRect(barX, y + 34, rageWidth, 6);
    else ctx.fillRect(barX + barW - rageWidth, y + 34, rageWidth, 6);

    if (rage >= 100) {
      ctx.fillStyle = '#ffe66d';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillText('MAX', align === 'left' ? barX + barW - 28 : barX + 28, y + 48);
    }
  }

  _renderUltimateBanner(ctx, worldWidth, worldHeight) {
    if (!this.ultimateBanner) return;

    const ratio = Math.max(0, Math.min(1, this.ultimateBanner.life / this.ultimateBanner.maxLife));
    ctx.save();
    ctx.globalAlpha = Math.min(1, ratio + 0.15);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
    ctx.fillRect(0, 0, worldWidth, worldHeight);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '18px "Press Start 2P", monospace';
    ctx.shadowColor = '#ff2d78';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffe66d';
    ctx.fillText(this.ultimateBanner.text, worldWidth / 2, worldHeight / 2 - 26);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  _renderCountdownBanner(ctx, worldWidth, worldHeight) {
    if (!this.countdownBanner) return;
    const banner = this.countdownBanner;
    const ratio = Math.max(0, Math.min(1, banner.life / banner.maxLife));
    const isFight = banner.label?.toUpperCase().startsWith('FIGHT');
    ctx.save();
    ctx.globalAlpha = Math.min(1, ratio + 0.15);
    ctx.fillStyle = isFight ? 'rgba(255, 45, 120, 0.18)' : 'rgba(0, 0, 0, 0.32)';
    ctx.fillRect(0, 0, worldWidth, worldHeight);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = banner.big ? 56 : 64;
    ctx.font = `${fontSize}px "Press Start 2P", monospace`;
    ctx.shadowColor = isFight ? '#ffe66d' : '#00f0ff';
    ctx.shadowBlur = 28;
    ctx.fillStyle = isFight ? '#ffe66d' : '#fff';
    ctx.fillText(banner.label, worldWidth / 2, worldHeight / 2);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /**
   * KO 击倒特效渲染（拳皇风格）
   * - 白屏闪烁
   * - K.O. 横幅（带描边和阴影）
   * - 径向暗角
   */
  _renderKoEffect(ctx, worldWidth, worldHeight) {
    // 白屏闪烁
    if (this._koFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this._koFlash / 150);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, worldWidth, worldHeight);
      ctx.restore();
    }

    // KO 横幅
    if (!this._koBanner) return;
    const banner = this._koBanner;
    const ratio = banner.life / banner.maxLife;

    ctx.save();

    // 径向暗角（慢动作期间加深）
    if (this._slowMotionTimer > 0) {
      const vignetteAlpha = 0.4 * (1 - ratio);
      ctx.fillStyle = `rgba(0, 0, 0, ${vignetteAlpha})`;
      ctx.fillRect(0, 0, worldWidth, worldHeight);
    }

    // K.O. 文字 — 从大到正常的缩放动画
    const enterProgress = Math.min(1, (1 - ratio) * 4); // 前 25% 时间做入场动画
    const scale = 1 + (1 - enterProgress) * 2; // 从 3x 缩到 1x
    const alpha = Math.min(1, enterProgress * 2);

    ctx.globalAlpha = alpha * Math.min(1, ratio * 3); // 最后淡出
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.translate(worldWidth / 2, worldHeight / 2 - 20);
    ctx.scale(scale, scale);

    // 文字阴影
    ctx.shadowColor = '#ff0040';
    ctx.shadowBlur = 30;

    // 描边
    ctx.font = 'bold 48px "Press Start 2P", monospace';
    ctx.strokeStyle = '#800020';
    ctx.lineWidth = 4;
    ctx.strokeText('K.O.', 0, 0);

    // 填充（渐变）
    const grad = ctx.createLinearGradient(0, -24, 0, 24);
    grad.addColorStop(0, '#ffe66d');
    grad.addColorStop(0.5, '#ff2d78');
    grad.addColorStop(1, '#ff0040');
    ctx.fillStyle = grad;
    ctx.fillText('K.O.', 0, 0);

    ctx.shadowBlur = 0;
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
