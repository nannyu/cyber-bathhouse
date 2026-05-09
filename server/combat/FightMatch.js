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
    facing: side === 'left' ? 1 : -1,
    hurtbox: { x: -14, y: -50, width: 28, height: 50 },
    actionState: 'idle',
    currentSkillId: null,
    stateFrame: 0,
    stunFrames: 0,
    guardFrames: 0,
    comboCounter: 0,
    comboRageGained: 0,
    cooldowns: {},
    inputQueue: [],
    lastIntent: 'neutral',
  };
}

export class FightMatch {
  constructor(attacker, defender, { arenaId = 'main_pool_ring' } = {}) {
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

    this.attackerId = attacker.id;
    this.attackerName = attacker.name;
    this.defenderId = defender.id;
    this.defenderName = defender.name;

    this.fighters = {
      [attacker.id]: createFighter(attacker, 'left'),
      [defender.id]: createFighter(defender, 'right'),
    };

    this.eventLog = [];
    this._arenaPositioned = false;
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

  finish(winnerId, loserId) {
    this.state = 'finished';
    this.finished = true;
    this.winnerId = winnerId;
    this.loserId = loserId;
    this.finishedAt = Date.now();
    this.recordEvent('fight:ko', { winnerId, loserId });
  }

  getSnapshot() {
    return {
      id: this.id,
      state: this.state,
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
      winnerId: this.winnerId,
      loserId: this.loserId,
    };
  }

  toJSON() {
    const attacker = this.getFighter(this.attackerId);
    const defender = this.getFighter(this.defenderId);
    return {
      id: this.id,
      state: this.state,
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
    };
  }
}
