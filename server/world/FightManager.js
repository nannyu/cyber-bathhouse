/**
 * 战斗系统
 */

import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from '../config.js';

/**
 * 单场战斗实例
 */
class Fight {
  constructor(attacker, defender) {
    this.id = `fight_${uuidv4().slice(0, 8)}`;
    this.attackerId = attacker.id;
    this.attackerName = attacker.name;
    this.defenderId = defender.id;
    this.defenderName = defender.name;
    this.startTime = Date.now();
    this._lastAttackTime = 0;
    this.finished = false;
    this.winnerId = null;
    this.loserId = null;
  }

  toJSON() {
    return {
      id: this.id,
      attacker: { id: this.attackerId, name: this.attackerName },
      defender: { id: this.defenderId, name: this.defenderName },
      finished: this.finished,
      winnerId: this.winnerId,
    };
  }
}

export class FightManager {
  constructor() {
    /** @type {Map<string, Fight>} fightId → Fight */
    this._fights = new Map();
  }

  /**
   * 发起战斗
   * @param {import('./User.js').User} attacker
   * @param {import('./User.js').User} defender
   * @returns {{ success: boolean, fight?: Fight, error?: string }}
   */
  startFight(attacker, defender) {
    if (attacker.id === defender.id) {
      return { success: false, error: '不能挑战自己', code: 'CANNOT_FIGHT_SELF' };
    }
    if (attacker.fightId) {
      return { success: false, error: '你已在战斗中', code: 'ALREADY_FIGHTING' };
    }
    if (defender.fightId) {
      return { success: false, error: `${defender.name} 正在战斗中`, code: 'ALREADY_FIGHTING' };
    }

    const fight = new Fight(attacker, defender);
    this._fights.set(fight.id, fight);

    attacker.fightId = fight.id;
    attacker.state = 'fighting';
    defender.fightId = fight.id;
    defender.state = 'fighting';

    return { success: true, fight };
  }

  /**
   * 触发自动战斗
   * @param {number} now
   * @param {Map<string, import('./User.js').User>} users
   * @returns {Array<Object>}
   */
  tickAutoAttacks(now, users) {
    const results = [];
    for (const fight of this._fights.values()) {
      if (fight.finished) continue;

      // 初始等待 2 秒开始第一下，或距上次超过 2 秒
      if (fight._lastAttackTime === 0) {
         fight._lastAttackTime = now; // 给个启动缓冲
      } else if (now - fight._lastAttackTime >= 2000) {
        fight._lastAttackTime = now;
        const attacker = users.get(fight.attackerId);
        const defender = users.get(fight.defenderId);
        if (!attacker || !defender) continue;
        
        const res = this.applyDamage(attacker, defender);
        if (res) results.push(res);
      }
    }
    return results;
  }

  /**
   * 计算伤害并应用到用户
   * @param {import('./User.js').User} attacker
   * @param {import('./User.js').User} defender
   * @returns {Object} 攻击结果
   */
  applyDamage(attacker, defender) {
    const fight = this._fights.get(attacker.fightId);
    if (!fight) return null;

    // 随机伤害 0 到 15
    const myDamage = Math.floor(Math.random() * 16);
    const counterDamage = Math.floor(Math.random() * 16);

    defender.hp = Math.max(0, defender.hp - myDamage);
    attacker.hp = Math.max(0, attacker.hp - counterDamage);

    const result = {
      fightId: fight.id,
      attackerId: attacker.id,
      defenderId: defender.id,
      attackerDamage: myDamage,
      counterDamage,
      attackerHp: attacker.hp,
      defenderHp: defender.hp,
      attackerName: attacker.name,
      defenderName: defender.name,
    };

    // 检查战斗结束
    if (defender.hp <= 0 || attacker.hp <= 0) {
      const winner = defender.hp <= 0 ? attacker : defender;
      const loser = winner.id === attacker.id ? defender : attacker;

      fight.finished = true;
      fight.winnerId = winner.id;
      fight.loserId = loser.id;

      // 恢复双方
      winner.hp = CONFIG.FIGHT.MAX_HP;
      winner.fightId = null;
      winner.state = 'idle'; // 清除战斗状态以允许重置

      loser.fightId = null;
      loser.state = 'idle';
      
      // NPC 战败直接满血，否则剩 15 点
      if (loser.id.startsWith('npc_')) {
        loser.hp = CONFIG.FIGHT.MAX_HP;
      } else {
        loser.hp = 15;
      }

      // 恢复状态
      winner._checkZoneState();
      loser._checkZoneState();

      result.finished = true;
      result.winnerId = winner.id;
      result.loserId = loser.id;
      result.winnerName = winner.name;
      result.loserName = loser.name;

      // 清理
      this._fights.delete(fight.id);
    } else {
      result.finished = false;
    }

    return result;
  }

  /**
   * 强制结束包含某用户的战斗（用户离线时）
   * @param {string} userId
   * @param {Map<string, import('./User.js').User>} users
   */
  forceEndFight(userId, users) {
    const fight = this._findFightByUser(userId);
    if (!fight) return null;

    const opponentId = fight.attackerId === userId ? fight.defenderId : fight.attackerId;
    const opponent = users.get(opponentId);

    if (opponent) {
      opponent.hp = CONFIG.FIGHT.MAX_HP;
      opponent.fightId = null;
      opponent._checkZoneState();
    }

    fight.finished = true;
    fight.winnerId = opponentId;
    this._fights.delete(fight.id);

    return { fightId: fight.id, winnerId: opponentId };
  }

  /**
   * 获取所有进行中的战斗
   */
  getActiveFights() {
    return [...this._fights.values()]
      .filter(f => !f.finished)
      .map(f => f.toJSON());
  }

  /**
   * 查找包含指定用户的战斗
   * @param {string} userId
   * @returns {Fight|undefined}
   */
  _findFightByUser(userId) {
    for (const fight of this._fights.values()) {
      if (!fight.finished && (fight.attackerId === userId || fight.defenderId === userId)) {
        return fight;
      }
    }
    return undefined;
  }
}
