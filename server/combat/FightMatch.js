/**
 * A server-authoritative AI fight match.
 */

import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from '../config.js';

function createFighter(user, side) {
  return {
    userId: user.id,
    name: user.name,
    side,
    hp: user.hp ?? CONFIG.FIGHT.MAX_HP,
    maxHp: CONFIG.FIGHT.MAX_HP,
    rage: 0,
    rageState: 'charging',
    x: Math.round(user.x),
    y: Math.round(user.y),
    vx: 0,
    vy: 0,
    facing: side === 'left' ? 1 : -1,
    hurtbox: { x: -14, y: -50, width: 28, height: 50 },
    actionState: 'idle',
    currentSkillId: null,
    stateFrame: 0,
    velocityFrames: 0,
    phase: null,
    phaseFrame: 0,
    stunFrames: 0,
    guardFrames: 0,
    comboCounter: 0,
    comboRageGained: 0,
    idleFramesCounter: 0,
    cooldowns: {},
    inputQueue: [],
    lastIntent: 'neutral',
  };
}

/**
 * Phase machine: queue → walk_in → countdown → active → finished.
 * 仅 active 阶段会真正跑战斗逻辑；其他阶段由 FightManager 的 staging tick 推进。
 */
export const FIGHT_PHASES = Object.freeze({
  QUEUE: 'queue',
  WALK_IN: 'walk_in',
  COUNTDOWN: 'countdown',
  ACTIVE: 'active',
  FINISHED: 'finished',
});

export class FightMatch {
  constructor(attacker, defender, { arenaId = 'arena_floor', queueOrder = 0 } = {}) {
    this.id = `fight_${uuidv4().slice(0, 8)}`;
    this.state = 'active';
    this.arenaId = arenaId;
    this.frame = 0;
    this.seed = Math.floor(Math.random() * 1000000);
    this.startTime = Date.now();
    this.startedAt = this.startTime;
    this.finishedAt = null;
    this.finished = false;
    this.winnerId = null;
    this.loserId = null;
    /** @type {'ko'|'time'|'draw'|null} */
    this.finishOutcome = null;

    this.attackerId = attacker.id;
    this.attackerName = attacker.name;
    this.defenderId = defender.id;
    this.defenderName = defender.name;

    this.fighters = {
      [attacker.id]: createFighter(attacker, 'left'),
      [defender.id]: createFighter(defender, 'right'),
    };

    this.eventLog = [];
    this.projectiles = [];
    this._arenaPositioned = false;

    // Staging
    this.phase = FIGHT_PHASES.QUEUE;
    this.phaseStartedAt = Date.now();
    this.queueOrder = queueOrder;          // 进入队列时的序号（越小越先打）
    this.countdownEndsAt = null;           // 倒计时结束时间戳
    this.lastCountdownNumber = null;       // 已广播过的最大倒计时整秒，避免重复发
  }

  setPhase(phase, now = Date.now()) {
    this.phase = phase;
    this.phaseStartedAt = now;
  }

  getFighter(userId) {
    return this.fighters[userId] || null;
  }

  getOpponentId(userId) {
    if (userId === this.attackerId) return this.defenderId;
    if (userId === this.defenderId) return this.attackerId;
    return null;
  }

  getOpponent(userId) {
    const opponentId = this.getOpponentId(userId);
    return opponentId ? this.getFighter(opponentId) : null;
  }

  includesUser(userId) {
    return userId === this.attackerId || userId === this.defenderId;
  }

  recordEvent(type, payload = {}) {
    const event = {
      id: `evt_${uuidv4().slice(0, 8)}`,
      matchId: this.id,
      frame: this.frame,
      type,
      payload,
      timestamp: Date.now(),
    };
    this.eventLog.push(event);
    return event;
  }

  finish(winnerId, loserId, { outcome = 'ko' } = {}) {
    this.state = 'finished';
    this.finished = true;
    this.winnerId = winnerId;
    this.loserId = loserId;
    this.finishOutcome = outcome;
    this.finishedAt = Date.now();
  }

  /** 时间到且双方血量相同（战斗事件由 CombatEngine 写入 eventLog） */
  finishDraw() {
    this.state = 'finished';
    this.finished = true;
    this.winnerId = null;
    this.loserId = null;
    this.finishOutcome = 'draw';
    this.finishedAt = Date.now();
  }

  getSnapshot() {
    return {
      id: this.id,
      state: this.state,
      phase: this.phase,
      queueOrder: this.queueOrder,
      countdownEndsAt: this.countdownEndsAt,
      arenaId: this.arenaId,
      frame: this.frame,
      seed: this.seed,
      fighters: Object.values(this.fighters).map(f => ({
        ...f,
        currentAction: f.currentAction ? {
          type: f.currentAction.type,
          phase: f.currentAction.phase,
          skillId: f.currentAction.skill?.id ?? null,
          skillName: f.currentAction.skill?.name ?? null,
          frame: f.currentAction.frame,
        } : null,
      })),
      projectiles: this.projectiles.map((p) => ({
        id: p.id,
        ownerId: p.ownerId,
        x: Math.round(p.x),
        y: Math.round(p.y),
        width: p.width,
        height: p.height,
        facing: p.facing,
      })),
      winnerId: this.winnerId,
      loserId: this.loserId,
      finishOutcome: this.finishOutcome,
      roundDurationFrames: CONFIG.ARENA_FIGHT.roundDurationFrames,
      roundRemainingFrames:
        this.phase === FIGHT_PHASES.ACTIVE && !this.finished
          ? Math.max(0, CONFIG.ARENA_FIGHT.roundDurationFrames - this.frame)
          : null,
    };
  }

  toJSON() {
    const attacker = this.getFighter(this.attackerId);
    const defender = this.getFighter(this.defenderId);
    return {
      id: this.id,
      state: this.state,
      phase: this.phase,
      queueOrder: this.queueOrder,
      countdownEndsAt: this.countdownEndsAt,
      frame: this.frame,
      attacker: {
        id: this.attackerId,
        name: this.attackerName,
        hp: attacker?.hp ?? CONFIG.FIGHT.MAX_HP,
        rage: attacker?.rage ?? 0,
        rageState: attacker?.rageState ?? 'charging',
      },
      defender: {
        id: this.defenderId,
        name: this.defenderName,
        hp: defender?.hp ?? CONFIG.FIGHT.MAX_HP,
        rage: defender?.rage ?? 0,
        rageState: defender?.rageState ?? 'charging',
      },
      finished: this.finished,
      winnerId: this.winnerId,
      finishOutcome: this.finishOutcome,
      roundDurationSec: CONFIG.ARENA_FIGHT.roundDurationSec,
      roundRemainingFrames:
        this.phase === FIGHT_PHASES.ACTIVE && !this.finished
          ? Math.max(0, CONFIG.ARENA_FIGHT.roundDurationFrames - this.frame)
          : null,
    };
  }
}
