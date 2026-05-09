/**
 * Opponent behavior profiling for adaptive AI combat strategy.
 *
 * Tracks observed actions and suggests counter-strategies.
 */

export class OpponentProfile {
  constructor() {
    this.framesObserved = 0;
    this.actionCounts = {
      block: 0,
      light_punch: 0,
      heavy_strike: 0,
      medium_kick: 0,
      throw: 0,
      move: 0,
      idle: 0,
    };
    this.hitsTaken = 0;
    this.blocks = 0;
    this.consecutiveGuards = 0;
    this.maxConsecutiveGuards = 0;
  }

  /**
   * Record an observed action from the opponent.
   * @param {string} actionType - 'skill' | 'move' | 'defend' | 'idle'
   * @param {string|null} skillId
   */
  recordAction(actionType, skillId) {
    this.framesObserved++;

    if (actionType === 'defend') {
      this.actionCounts.block++;
      this.consecutiveGuards++;
      this.maxConsecutiveGuards = Math.max(this.maxConsecutiveGuards, this.consecutiveGuards);
    } else {
      this.consecutiveGuards = 0;
      if (actionType === 'skill' && skillId) {
        this.actionCounts[skillId] = (this.actionCounts[skillId] || 0) + 1;
      } else if (actionType === 'move') {
        this.actionCounts.move++;
      } else {
        this.actionCounts.idle++;
      }
    }
  }

  recordHitTaken() {
    this.hitsTaken++;
  }

  recordBlock() {
    this.blocks++;
  }

  /** @returns {number} 0-1 */
  getGuardRate() {
    if (this.framesObserved < 5) return 0;
    return this.actionCounts.block / this.framesObserved;
  }

  /** @returns {number} 0-1 */
  getAttackRate() {
    if (this.framesObserved < 5) return 0;
    const attacks = this.actionCounts.light_punch + this.actionCounts.heavy_strike
      + this.actionCounts.medium_kick + this.actionCounts.throw;
    return attacks / this.framesObserved;
  }

  /** @returns {number} 0-1 */
  getThrowRate() {
    if (this.framesObserved < 5) return 0;
    return (this.actionCounts.throw || 0) / this.framesObserved;
  }

  /** @returns {number} 0-1 */
  getHeavyCommitRate() {
    if (this.framesObserved < 5) return 0;
    return (this.actionCounts.heavy_strike || 0) / this.framesObserved;
  }

  /**
   * Suggest a counter-strategy based on observed behavior.
   * @returns {string|null} style name or null if no strong pattern
   */
  suggestCounterStyle() {
    const guardRate = this.getGuardRate();
    const attackRate = this.getAttackRate();
    const heavyRate = this.getHeavyCommitRate();

    if (this.framesObserved < 10) return null;

    // Opponent guards a lot → throw to break guard
    if (guardRate > 0.35 || this.maxConsecutiveGuards >= 3) {
      return 'throw_mixup';
    }

    // Opponent attacks aggressively → bait and punish
    if (attackRate > 0.65) {
      return 'bait_and_punish';
    }

    // Opponent uses heavy attacks often → counter-hit with light attacks
    if (heavyRate > 0.25) {
      return 'counter_hit';
    }

    // Opponent throws often → keep distance and punish
    if (this.getThrowRate() > 0.15) {
      return 'bait_and_punish';
    }

    return null;
  }

  toJSON() {
    return {
      framesObserved: this.framesObserved,
      guardRate: this.getGuardRate(),
      attackRate: this.getAttackRate(),
      throwRate: this.getThrowRate(),
      suggestedStyle: this.suggestCounterStyle(),
    };
  }
}
