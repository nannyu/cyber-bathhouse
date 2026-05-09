/**
 * Rage/ultimate resource rules.
 */

export const RAGE_CONFIG = {
  MAX: 100,
  DAMAGE_TAKEN_MULTIPLIER: 1.2,
  DAMAGE_DEALT_MULTIPLIER: 0.15,
  BLOCKED_DAMAGE_MULTIPLIER: 0.4,
  PERFECT_GUARD_BONUS: 6,
  COMBO_GAIN_CAP: 25,
};

export class RageSystem {
  constructor(config = RAGE_CONFIG) {
    this.config = config;
  }

  gainFromDamageTaken(fighter, damage, { blocked = false, perfectGuard = false } = {}) {
    if (!fighter || fighter.rage >= this.config.MAX) {
      return 0;
    }

    let rawGain = blocked
      ? damage * this.config.BLOCKED_DAMAGE_MULTIPLIER
      : damage * this.config.DAMAGE_TAKEN_MULTIPLIER;

    if (perfectGuard) {
      rawGain += this.config.PERFECT_GUARD_BONUS;
    }

    const comboRemaining = Math.max(
      0,
      this.config.COMBO_GAIN_CAP - (fighter.comboRageGained || 0),
    );
    const cappedGain = Math.min(rawGain, comboRemaining);
    const gain = Math.min(this.config.MAX - fighter.rage, Math.max(0, Math.round(cappedGain)));

    fighter.rage += gain;
    fighter.comboRageGained = (fighter.comboRageGained || 0) + gain;
    fighter.rageState = fighter.rage >= this.config.MAX ? 'ready' : 'charging';
    return gain;
  }

  gainFromDamageDealt(fighter, damage) {
    if (!fighter || fighter.rage >= this.config.MAX) {
      return 0;
    }

    const gain = Math.min(
      this.config.MAX - fighter.rage,
      Math.max(0, Math.round(damage * this.config.DAMAGE_DEALT_MULTIPLIER)),
    );
    fighter.rage += gain;
    fighter.rageState = fighter.rage >= this.config.MAX ? 'ready' : 'charging';
    return gain;
  }

  canSpendUltimate(fighter, cost = this.config.MAX) {
    return !!fighter && fighter.rage >= cost;
  }

  spendUltimate(fighter, cost = this.config.MAX) {
    if (!this.canSpendUltimate(fighter, cost)) {
      return false;
    }
    fighter.rage = Math.max(0, fighter.rage - cost);
    fighter.rageState = fighter.rage >= this.config.MAX ? 'ready' : 'spent';
    fighter.comboRageGained = 0;
    if (fighter.rage < this.config.MAX) {
      fighter._ultimateReadyAnnounced = false;
    }
    return true;
  }

  resetComboGain(fighter) {
    if (fighter) {
      fighter.comboRageGained = 0;
    }
  }
}
