/**
 * 战斗系统 — 管理 staging 流程：
 *   queue(候场) → walk_in(走入场地) → countdown(3-2-1) → active(对战) → finished
 * 同一时刻仅允许一场 active；其余按发起顺序排队，并把双方拉到两侧候场座位等待。
 */

import { CONFIG } from '../config.js';
import { FightMatch, FIGHT_PHASES } from '../combat/FightMatch.js';
import { CombatEngine } from '../combat/CombatEngine.js';

const ARENA = CONFIG.ARENA_FIGHT;

export class FightManager {
  constructor() {
    /** @type {Map<string, FightMatch>} fightId → FightMatch (按发起顺序插入) */
    this._fights = new Map();
    this.combatEngine = new CombatEngine();

    /** @type {number} 全局自增 — 给 FightMatch.queueOrder 用 */
    this._queueCounter = 0;

    /** @type {number|null} 上一场结束时间戳（毫秒），用于 postFightWaitMs 间隔 */
    this._lastFinishedAt = null;

    /** @type {Function|null} (event,data)=>void —— 由 World 注入用于广播 */
    this._broadcastFn = null;
  }

  setBroadcast(fn) {
    this._broadcastFn = fn;
  }

  _broadcast(event, data) {
    if (this._broadcastFn) this._broadcastFn(event, data);
  }

  /**
   * 发起战斗 — 创建 FightMatch，进入 queue 阶段。
   * 真正的入场/对战由 staging tick 推动。
   */
  startFight(attacker, defender) {
    if (attacker.id === defender.id) {
      return { success: false, error: '不能挑战自己', code: 'CANNOT_FIGHT_SELF' };
    }
    if (attacker.fightId) {
      return { success: false, error: '你已在战斗中或排队中', code: 'ALREADY_FIGHTING' };
    }
    if (defender.fightId) {
      return { success: false, error: `${defender.name} 已在战斗中或排队中`, code: 'ALREADY_FIGHTING' };
    }

    this._queueCounter += 1;
    const fight = new FightMatch(attacker, defender, { queueOrder: this._queueCounter });
    this._fights.set(fight.id, fight);

    attacker.fightId = fight.id;
    attacker.lastFightResult = null;
    attacker.state = 'awaiting_fight';
    defender.fightId = fight.id;
    defender.lastFightResult = null;
    defender.state = 'awaiting_fight';

    this._broadcast('fight:queued', {
      fightId: fight.id,
      attacker: { id: attacker.id, name: attacker.name },
      defender: { id: defender.id, name: defender.name },
      queueOrder: fight.queueOrder,
    });

    return { success: true, fight };
  }

  /**
   * Tick 一次：推进 staging（走位、倒计时）+ 真正的战斗逻辑。
   * @param {number} now - 当前时间戳（毫秒）
   * @param {Map<string,import('./User.js').User>} users
   * @param {number} dt - 帧间隔毫秒
   */
  tickAutoAttacks(now, users, dt = 50) {
    const results = [];

    // 1) 找出当前活跃槽位（active / walk_in / countdown），以及候补队列
    const active = this._findActiveFight();
    const queued = this._listQueued();

    // 2) 候场队员去座位
    queued.forEach((fight, rank) => this._driveBenchSeats(fight, users, rank, dt));

    // 3) 推进活跃槽
    if (active) {
      this._tickActive(active, users, now, dt, results);
    }

    // 4) 没有活跃槽 → 间隔到了就拉下一场进入 walk_in
    if (!active && queued.length > 0) {
      const since = this._lastFinishedAt ? now - this._lastFinishedAt : Infinity;
      if (since >= ARENA.postFightWaitMs) {
        this._promoteToWalkIn(queued[0], users, now);
      }
    }

    return results;
  }

  // ─── 槽位/队列查询 ────────────────────────────────────────────

  _findActiveFight() {
    for (const fight of this._fights.values()) {
      if (fight.finished) continue;
      if (fight.phase !== FIGHT_PHASES.QUEUE) return fight;
    }
    return null;
  }

  _listQueued() {
    const out = [];
    for (const fight of this._fights.values()) {
      if (fight.finished) continue;
      if (fight.phase === FIGHT_PHASES.QUEUE) out.push(fight);
    }
    out.sort((a, b) => a.queueOrder - b.queueOrder);
    return out;
  }

  // ─── Staging 各阶段 ──────────────────────────────────────────

  _tickActive(fight, users, now, dt, resultsOut) {
    if (fight.phase === FIGHT_PHASES.WALK_IN) {
      this._tickWalkIn(fight, users, now, dt);
      return;
    }
    if (fight.phase === FIGHT_PHASES.COUNTDOWN) {
      this._tickCountdown(fight, users, now);
      return;
    }
    if (fight.phase === FIGHT_PHASES.ACTIVE) {
      const frameResults = this.combatEngine.tickMatch(fight, users);
      for (const res of frameResults) {
        if (res?.finished) this._finalizeFight(fight, users, now);
        if (res) resultsOut.push(res);
      }
    }
  }

  _promoteToWalkIn(fight, users, now) {
    const attacker = users.get(fight.attackerId);
    const defender = users.get(fight.defenderId);
    if (!attacker || !defender) return;

    fight.setPhase(FIGHT_PHASES.WALK_IN, now);

    attacker.state = 'walking_to_arena';
    attacker.targetX = ARENA.leftSpawn.x;
    attacker.targetY = ARENA.leftSpawn.y;

    defender.state = 'walking_to_arena';
    defender.targetX = ARENA.rightSpawn.x;
    defender.targetY = ARENA.rightSpawn.y;

    this._broadcast('fight:walkin', {
      fightId: fight.id,
      left: { id: attacker.id, name: attacker.name, target: ARENA.leftSpawn },
      right: { id: defender.id, name: defender.name, target: ARENA.rightSpawn },
    });
  }

  _tickWalkIn(fight, users, now, dt) {
    const attacker = users.get(fight.attackerId);
    const defender = users.get(fight.defenderId);
    if (!attacker || !defender) return;

    const ax = attacker.x;
    const ay = attacker.y;
    const bx = defender.x;
    const by = defender.y;
    this._stepTowards(attacker, ARENA.leftSpawn, dt);
    this._stepTowards(defender, ARENA.rightSpawn, dt);
    this._syncFacingFromMotion(attacker, ax, ay);
    this._syncFacingFromMotion(defender, bx, by);

    const arrA = this._reached(attacker, ARENA.leftSpawn);
    const arrB = this._reached(defender, ARENA.rightSpawn);

    if (arrA && arrB) {
      // 校准位置 + 切入倒计时
      attacker.x = ARENA.leftSpawn.x;
      attacker.y = ARENA.leftSpawn.y;
      attacker.targetX = attacker.x;
      attacker.targetY = attacker.y;
      attacker.state = 'fighting';
      attacker.actionState = 'idle';

      defender.x = ARENA.rightSpawn.x;
      defender.y = ARENA.rightSpawn.y;
      defender.targetX = defender.x;
      defender.targetY = defender.y;
      defender.state = 'fighting';
      defender.actionState = 'idle';

      // 同步给战斗体
      const af = fight.getFighter(attacker.id);
      const df = fight.getFighter(defender.id);
      if (af) { af.x = attacker.x; af.y = attacker.y; af.facing = 1; }
      if (df) { df.x = defender.x; df.y = defender.y; df.facing = -1; }
      fight._arenaPositioned = true;

      fight.setPhase(FIGHT_PHASES.COUNTDOWN, now);
      fight.countdownEndsAt = now + ARENA.countdownMs;
      fight.lastCountdownNumber = null;

      // 宠物在读秒阶段就前往加油位置
      if (attacker?.pet) attacker.pet.startCheering('left');
      if (defender?.pet) defender.pet.startCheering('right');

      this._broadcast('fight:countdown:start', {
        fightId: fight.id,
        countdownMs: ARENA.countdownMs,
        endsAt: fight.countdownEndsAt,
      });
    }
  }

  _tickCountdown(fight, users, now) {
    const attacker = users.get(fight.attackerId);
    const defender = users.get(fight.defenderId);
    if (attacker) {
      attacker.state = 'fighting';
      attacker.actionState = 'idle';
      attacker.facing = 1;
    }
    if (defender) {
      defender.state = 'fighting';
      defender.actionState = 'idle';
      defender.facing = -1;
    }

    const remainMs = (fight.countdownEndsAt || now) - now;
    const seconds = Math.max(0, Math.ceil(remainMs / 1000));
    // 仅广播 3-2-1（FIGHT! 由后续 fight:start 负责，避免重复横幅）
    if (seconds > 0 && fight.lastCountdownNumber !== seconds) {
      fight.lastCountdownNumber = seconds;
      this._broadcast('fight:countdown', {
        fightId: fight.id,
        seconds,
        label: String(seconds),
      });
    }

    if (remainMs <= 0) {
      fight.setPhase(FIGHT_PHASES.ACTIVE, now);

      this._broadcast('fight:start', {
        fightId: fight.id,
        attackerId: fight.attackerId,
        defenderId: fight.defenderId,
        roundDurationSec: ARENA.roundDurationSec,
        roundDurationFrames: ARENA.roundDurationFrames,
      });
    }
  }

  _driveBenchSeats(fight, users, rank, dt) {
    const attacker = users.get(fight.attackerId);
    const defender = users.get(fight.defenderId);
    const leftSeat = ARENA.leftBench[rank % ARENA.leftBench.length];
    const rightSeat = ARENA.rightBench[rank % ARENA.rightBench.length];

    if (attacker) {
      if (attacker.state !== 'awaiting_fight') attacker.state = 'awaiting_fight';
      attacker.targetX = leftSeat.x;
      attacker.targetY = leftSeat.y;
      const px = attacker.x;
      const py = attacker.y;
      this._stepTowards(attacker, leftSeat, dt);
      this._syncFacingFromMotion(attacker, px, py);
    }
    if (defender) {
      if (defender.state !== 'awaiting_fight') defender.state = 'awaiting_fight';
      defender.targetX = rightSeat.x;
      defender.targetY = rightSeat.y;
      const px = defender.x;
      const py = defender.y;
      this._stepTowards(defender, rightSeat, dt);
      this._syncFacingFromMotion(defender, px, py);
    }
  }

  // ─── 行走小工具 ──────────────────────────────────────────────

  _stepTowards(user, target, dt) {
    const dx = target.x - user.x;
    const dy = target.y - user.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < ARENA.walkArrivedDist) {
      user.x = target.x;
      user.y = target.y;
      return true;
    }
    const step = ARENA.walkSpeed * (dt / 1000);
    const ratio = Math.min(step / dist, 1);
    user.x += dx * ratio;
    user.y += dy * ratio;
    return false;
  }

  _reached(user, target) {
    const dx = target.x - user.x;
    const dy = target.y - user.y;
    return Math.sqrt(dx * dx + dy * dy) < ARENA.walkArrivedDist;
  }

  /** 按本帧位移设置朝向；避免面朝场地却横向漂移（视觉上倒着走） */
  _syncFacingFromMotion(user, prevX, prevY) {
    const dx = user.x - prevX;
    const dy = user.y - prevY;
    if (Math.abs(dx) > 0.02) {
      user.facing = dx > 0 ? 1 : -1;
      return;
    }
    if (Math.abs(dy) > 0.02) {
      user.facing = user.x < ARENA.centerX ? 1 : -1;
      return;
    }
  }

  // ─── 现有 API ────────────────────────────────────────────────

  attackByUser(userId, users) {
    const fight = this._findFightByUser(userId);
    if (!fight) return null;
    if (fight.phase !== FIGHT_PHASES.ACTIVE) {
      return { success: false, error: '尚未开始战斗', code: 'NOT_FIGHTING' };
    }
    const actor = users.get(userId);
    if (!actor) return null;
    this.combatEngine.applyManualAttack(fight, actor, users);
    return { success: true, queued: true };
  }

  queueAttackIntent(userId) {
    this.combatEngine.policyManager.queueIntent(userId, {
      intent: 'combo_confirm',
      skillId: 'light_punch',
    });
  }

  forceEndFight(userId, users) {
    const fight = this._findFightByUser(userId);
    if (!fight) return null;

    const opponentId = fight.attackerId === userId ? fight.defenderId : fight.attackerId;
    const opponent = users.get(opponentId);

    if (opponent) {
      opponent.hp = CONFIG.FIGHT.MAX_HP;
      opponent.rage = 0;
      opponent.rageState = 'charging';
      opponent.fightId = null;
      opponent.state = 'idle';
      this._resetCombatVisuals(opponent);
      opponent._checkZoneState?.();
      opponent.lastFightResult = {
        finished: true,
        fightId: fight.id,
        winnerId: opponentId,
        loserId: userId,
      };
    }

    fight.finished = true;
    fight.setPhase(FIGHT_PHASES.FINISHED);
    fight.winnerId = opponentId;
    this._fights.delete(fight.id);
    this._lastFinishedAt = Date.now();

    return { fightId: fight.id, winnerId: opponentId };
  }

  getActiveFights() {
    return [...this._fights.values()]
      .filter(f => !f.finished)
      .map(f => f.toJSON());
  }

  _findFightByUser(userId) {
    for (const fight of this._fights.values()) {
      if (!fight.finished && (fight.attackerId === userId || fight.defenderId === userId)) {
        return fight;
      }
    }
    return undefined;
  }

  getFightByUser(userId) {
    return this._findFightByUser(userId);
  }

  /** 战斗结束后清空用于渲染的格斗字段（否则会卡在受击/倒地动画） */
  _resetCombatVisuals(user) {
    if (!user) return;
    user.actionState = 'idle';
    user.currentSkillId = null;
    user.phase = null;
    user.phaseFrame = 0;
    user.vx = 0;
  }

  /**
   * 战斗结束（KO）后的清理。
   * @param {FightMatch} fight
   * @param {Map<string,import('./User.js').User>} users
   * @param {number} now
   */
  _finalizeFight(fight, users, now = Date.now()) {
    // 停止宠物加油
    const fAttacker = users.get(fight.attackerId);
    const fDefender = users.get(fight.defenderId);
    if (fAttacker?.pet) fAttacker.pet.stopCheering();
    if (fDefender?.pet) fDefender.pet.stopCheering();

    const isDraw = fight.finishOutcome === 'draw';

    if (isDraw) {
      for (const uid of [fight.attackerId, fight.defenderId]) {
        const u = users.get(uid);
        if (!u) continue;
        u.hp = CONFIG.FIGHT.MAX_HP;
        u.rage = 0;
        u.rageState = 'charging';
        u.fightId = null;
        u.state = 'idle';
        this._resetCombatVisuals(u);
        u._checkZoneState?.();
        u.lastFightResult = {
          finished: true,
          fightId: fight.id,
          winnerId: null,
          loserId: null,
          isDraw: true,
          finishOutcome: 'draw',
        };
      }
      fight.setPhase(FIGHT_PHASES.FINISHED, now);
      this._fights.delete(fight.id);
      this._lastFinishedAt = now;
      return;
    }

    const winner = users.get(fight.winnerId);
    const loser = users.get(fight.loserId);

    if (winner) {
      winner.hp = CONFIG.FIGHT.MAX_HP;
      winner.rage = 0;
      winner.rageState = 'charging';
      winner.fightId = null;
      winner.state = 'idle';
      this._resetCombatVisuals(winner);
      // NPC 胜利后延迟恢复，等胜利动作结束再走回原位
      if (winner.id.startsWith('npc_')) {
        winner._postDefeatDelay = 8000; // 胜利动画 3 秒 + 额外 5 秒
      } else {
        winner._checkZoneState?.();
      }
      winner.lastFightResult = {
        finished: true,
        fightId: fight.id,
        winnerId: fight.winnerId,
        loserId: fight.loserId,
        finishOutcome: fight.finishOutcome || 'ko',
      };
    }

    if (loser) {
      loser.fightId = null;
      loser.rage = 0;
      loser.rageState = 'charging';
      loser.hp = loser.id.startsWith('npc_') ? CONFIG.FIGHT.MAX_HP : 15;
      this._resetCombatVisuals(loser);
      // NPC 被击败后延迟恢复，不立即切换状态
      if (loser.id.startsWith('npc_')) {
        loser.state = 'idle';
        loser._postDefeatDelay = 5000; // 倒地动画完成后再等 5 秒
      } else {
        loser.state = 'idle';
        loser._checkZoneState?.();
      }
      loser.lastFightResult = {
        finished: true,
        fightId: fight.id,
        winnerId: fight.winnerId,
        loserId: fight.loserId,
        finishOutcome: fight.finishOutcome || 'ko',
      };
    }

    fight.setPhase(FIGHT_PHASES.FINISHED, now);
    this._fights.delete(fight.id);
    this._lastFinishedAt = now;
  }
}
