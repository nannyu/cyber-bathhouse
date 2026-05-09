/**
 * 战斗系统
 */

import { CONFIG } from '../config.js';
import { FightMatch } from '../combat/FightMatch.js';
import { CombatEngine } from '../combat/CombatEngine.js';

export class FightManager {
  constructor() {
    /** @type {Map<string, FightMatch>} fightId → FightMatch */
    this._fights = new Map();
    this.combatEngine = new CombatEngine();
  }

  /**
   * 发起战斗
   * @param {import('./User.js').User} attacker
   * @param {import('./User.js').User} defender
   * @returns {{ success: boolean, fight?: FightMatch, error?: string }}
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

    const fight = new FightMatch(attacker, defender);
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

      const frameResults = this.combatEngine.tickMatch(fight, now, users);
      for (const res of frameResults) {
        if (res?.finished) {
          this._finalizeFight(fight, users);
        }
        if (res) {
          results.push(res);
        }
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

    const result = this.combatEngine.applyExchange(fight, attacker, defender);
    if (result?.finished) {
      this._finalizeFight(fight, new Map([
        [attacker.id, attacker],
        [defender.id, defender],
      ]));
    }

    return result;
  }

  /**
   * Manual attack by a user in an active fight.
   * @param {string} userId
   * @param {Map<string, import('./User.js').User>} users
   */
  attackByUser(userId, users) {
    const fight = this._findFightByUser(userId);
    if (!fight) return null;
    const actor = users.get(userId);
    if (!actor) return null;

    const result = this.combatEngine.applyManualAttack(fight, actor, users);
    if (result?.finished) {
      this._finalizeFight(fight, users);
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
      opponent.rage = 0;
      opponent.rageState = 'charging';
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
   * @returns {FightMatch|undefined}
   */
  _findFightByUser(userId) {
    for (const fight of this._fights.values()) {
      if (!fight.finished && (fight.attackerId === userId || fight.defenderId === userId)) {
        return fight;
      }
    }
    return undefined;
  }

  /**
   * Get the active fight containing a user.
   * @param {string} userId
   */
  getFightByUser(userId) {
    return this._findFightByUser(userId);
  }

  /**
   * Finalize user state and remove a completed match.
   * @param {FightMatch} fight
   * @param {Map<string, import('./User.js').User>} users
   */
  _finalizeFight(fight, users) {
    const winner = users.get(fight.winnerId);
    const loser = users.get(fight.loserId);

    if (winner) {
      winner.hp = CONFIG.FIGHT.MAX_HP;
      winner.rage = 0;
      winner.rageState = 'charging';
      winner.fightId = null;
      winner.state = 'idle';
      winner._checkZoneState();
    }

    if (loser) {
      loser.fightId = null;
      loser.state = 'idle';
      loser.rage = 0;
      loser.rageState = 'charging';
      loser.hp = loser.id.startsWith('npc_') ? CONFIG.FIGHT.MAX_HP : 15;
      loser._checkZoneState();
    }

    this._fights.delete(fight.id);
  }
}
