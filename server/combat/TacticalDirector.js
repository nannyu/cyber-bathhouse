/**
 * Chooses medium-level combat intent from plan + current state.
 */

export class TacticalDirector {
  constructor(policyManager) {
    this.policyManager = policyManager;
  }

  chooseIntent(match, fighter, opponent) {
    const queuedIntent = this.policyManager.consumeIntent(fighter.userId);
    if (queuedIntent?.intent) {
      return {
        intent: queuedIntent.intent,
        skillId: queuedIntent.skillId || queuedIntent.skill_id || null,
        reason: 'queued_intent',
      };
    }

    const plan = this.policyManager.getPlan(fighter.userId);
    const distance = Math.abs((opponent?.x || 0) - (fighter?.x || 0));
    const ownHpRatio = fighter.hp / fighter.maxHp;
    const opponentHpRatio = opponent.hp / opponent.maxHp;

    if (fighter.rage >= 100 && opponentHpRatio <= 0.35) {
      return { intent: 'use_ultimate', skillId: 'neon_overdrive', reason: 'kill_confirm' };
    }

    if (fighter.rage >= 100 && ownHpRatio <= 0.25 && plan.ultimatePolicy !== 'never') {
      return { intent: 'use_ultimate', skillId: 'steam_reversal', reason: 'low_hp_reversal' };
    }

    if (ownHpRatio <= 0.25 && plan.style !== 'rushdown') {
      return { intent: 'block', skillId: 'guard', reason: 'low_hp_defense' };
    }

    if (distance > 70) {
      return { intent: 'approach', skillId: null, reason: 'out_of_range' };
    }

    switch (plan.style) {
      case 'rushdown':
      case 'snowball':
        return { intent: 'heavy_attack', skillId: 'heavy_strike', reason: plan.style };
      case 'turtle':
        return { intent: 'block', skillId: 'guard', reason: 'turtle' };
      case 'bait_and_punish':
        return Math.random() < 0.55
          ? { intent: 'retreat', skillId: null, reason: 'bait' }
          : { intent: 'whiff_punish', skillId: 'heavy_strike', reason: 'punish_window' };
      case 'counter_hit':
        return { intent: 'poke', skillId: 'light_punch', reason: 'counter_hit_setup' };
      default:
        return Math.random() < 0.72
          ? { intent: 'poke', skillId: 'light_punch', reason: 'footsies' }
          : { intent: 'heavy_attack', skillId: 'heavy_strike', reason: 'footsies_mix' };
    }
  }
}
