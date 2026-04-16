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
   * 执行攻击
   * @param {string} attackerId - 攻击者 ID
   * @returns {{ success: boolean, result?: Object, error?: string }}
   */
  performAttack(attackerId) {
    // 找到包含该玩家的战斗
    const fight = this._findFightByUser(attackerId);
    if (!fight) {
      return { success: false, error: '你不在战斗中', code: 'NOT_FIGHTING' };
    }

    // 检查攻击冷却
    const now = Date.now();
    if (now - fight._lastAttackTime < CONFIG.FIGHT.ATTACK_COOLDOWN) {
      return { success: false, error: '攻击冷却中，请稍候', code: 'COOLDOWN' };
    }
    fight._lastAttackTime = now;

    // 确定攻防双方
    const isAttacker = attackerId === fight.attackerId;
    const myId = attackerId;
    const opponentId = isAttacker ? fight.defenderId : fight.attackerId;

    return {
      success: true,
      myId,
      opponentId,
      fightId: fight.id,
    };
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

    // 随机伤害
    const { MIN_DAMAGE, MAX_DAMAGE } = CONFIG.FIGHT;
    const myDamage = MIN_DAMAGE + Math.floor(Math.random() * (MAX_DAMAGE - MIN_DAMAGE + 1));
    const counterDamage = MIN_DAMAGE + Math.floor(Math.random() * (MAX_DAMAGE - MIN_DAMAGE + 1));

    defender.hp = Math.max(0, defender.hp - myDamage);
    attacker.hp = Math.max(0, attacker.hp - counterDamage);

    const result = {
      fightId: fight.id,
      attackerDamage: myDamage,
      counterDamage,
      attackerHp: attacker.hp,
      defenderHp: defender.hp,
      attackerName: attacker.name,
      defenderName: defender.name,
    };

    // 检查战斗结束
    if (defender.hp <= 0 || attacker.hp <= 0) {
      const winnerId = defender.hp <= 0 ? attacker.id : defender.id;
      const loserId = winnerId === attacker.id ? defender.id : attacker.id;

      fight.finished = true;
      fight.winnerId = winnerId;
      fight.loserId = loserId;

      // 恢复双方
      attacker.hp = CONFIG.FIGHT.MAX_HP;
      defender.hp = CONFIG.FIGHT.MAX_HP;
      attacker.fightId = null;
      defender.fightId = null;

      // 恢复状态
      attacker._checkPoolState();
      defender._checkPoolState();

      result.finished = true;
      result.winnerId = winnerId;
      result.winnerName = winnerId === attacker.id ? attacker.name : defender.name;
      result.loserName = winnerId === attacker.id ? defender.name : attacker.name;

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
      opponent._checkPoolState();
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
