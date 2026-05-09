/**
 * Chooses medium-level combat intent from plan + current state.
 */

export class TacticalDirector {
  constructor(policyManager, skillRegistry = null) {
    this.policyManager = policyManager;
    this.skillRegistry = skillRegistry;
  }

  _canAffordSkill(fighter, skillId) {
    const sk = skillId && this.skillRegistry?.get?.(skillId);
    const cost = sk?.rageCost || 0;
    return cost <= 0 || (fighter?.rage || 0) >= cost;
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
    const ownHpRatio = fighter.hp / (fighter.maxHp || 100);
    const opponentHpRatio = opponent.hp / (opponent.maxHp || 100);

    // Ultimate: kill confirm
    if (fighter.rage >= 100 && opponentHpRatio <= 0.35) {
      return { intent: 'use_ultimate', skillId: 'neon_overdrive', reason: 'kill_confirm' };
    }

    // Ultimate: low HP reversal
    if (fighter.rage >= 100 && ownHpRatio <= 0.25 && plan.ultimatePolicy !== 'never') {
      return { intent: 'use_ultimate', skillId: 'steam_reversal', reason: 'low_hp_reversal' };
    }

    // Low HP defensive — 低血量时更谨慎但不完全放弃进攻
    if (ownHpRatio <= 0.25 && plan.style !== 'rushdown') {
      // 30% 概率防御，70% 概率殊死搏斗
      if (Math.random() < 0.3) {
        return { intent: 'block', skillId: 'guard', reason: 'low_hp_defense' };
      }
      // 低血量搏命：攻击欲望更强，优先重击搏一把
      if (distance < 50 && Math.random() < 0.5) {
        return { intent: 'heavy_attack', skillId: 'heavy_strike', reason: 'low_hp_all_in' };
      }
      if (distance < 70) {
        return { intent: 'poke', skillId: 'light_punch', reason: 'low_hp_desperation' };
      }
      return { intent: 'approach', skillId: null, reason: 'low_hp_rush' };
    }

    // Analyze opponent's current action
    const oppAction = opponent?.currentAction;
    const oppGuarding = oppAction?.type === 'defend' && oppAction.phase === 'active';

    // Close-range throw: highest priority mixup
    if (distance < 60 && Math.random() < 0.45) {
      return { intent: 'throw', skillId: 'throw', reason: 'close_mixup' };
    }

    // Throw mixup: opponent is guarding → throw breaks guard
    if (oppGuarding && distance < 55 && Math.random() < 0.7) {
      return { intent: 'throw', skillId: 'throw', reason: 'guard_break' };
    }

    // Interrupt opponent's slow startup
    if (oppAction?.phase === 'startup' && (oppAction.skill?.startupFrames || 0) > 5 && distance < 75) {
      return { intent: 'poke', skillId: 'light_punch', reason: 'interrupt' };
    }

    // Punish opponent's recovery (whiff punish)
    if (oppAction?.phase === 'recovery' && distance < 65) {
      return { intent: 'whiff_punish', skillId: 'heavy_strike', reason: 'punish_recovery' };
    }

    // Distance management with random footsies movement
    const preferredDist = this._preferredDistance(plan.style);
    if (distance > preferredDist + 20) {
      return { intent: 'approach', skillId: null, reason: 'close_gap' };
    }
    if (distance < preferredDist - 20) {
      return { intent: 'retreat', skillId: null, reason: 'create_space' };
    }
    if ((fighter.idleFramesCounter || 0) > 8) {
      return { intent: 'feint', skillId: null, reason: 'anti_idle' };
    }
    // 随机垂直闪避（增加战斗立体感）
    if (Math.random() < 0.08) {
      return { intent: 'sidestep', skillId: null, reason: 'vertical_dodge' };
    }
    // 随机蹲下闪避高段攻击或发动下段攻击
    if (Math.random() < 0.06) {
      return Math.random() < 0.5
        ? { intent: 'crouch', skillId: null, reason: 'crouch_dodge' }
        : { intent: 'crouch_attack', skillId: 'crouch_kick', reason: 'low_mixup' };
    }
    // 随机跳跃接近或空中攻击
    if (Math.random() < 0.06) {
      return distance > 50
        ? { intent: 'jump', skillId: null, reason: 'jump_approach' }
        : { intent: 'jump_attack', skillId: 'jump_kick', reason: 'overhead_mixup' };
    }
    // Random spacing adjustment even when in range (creates visible movement)
    if (Math.random() < 0.15) {
      return Math.random() < 0.5
        ? { intent: 'approach', skillId: null, reason: 'pressure' }
        : { intent: 'retreat', skillId: null, reason: 'spacing' };
    }

    // Style-based combat
    switch (plan.style) {
      case 'rushdown':
      case 'snowball': {
        if (distance > 80) return { intent: 'approach', skillId: 'dash', reason: 'rushdown_dash' };
        if (distance > 50) return { intent: 'approach', skillId: null, reason: 'rushdown_close' };
        if (oppGuarding && distance < 35) return { intent: 'throw', skillId: 'throw', reason: 'rushdown_throw' };
        const roll = Math.random();
        if (roll < 0.5) return { intent: 'heavy_attack', skillId: 'heavy_strike', reason: plan.style };
        if (roll < 0.8) return { intent: 'poke', skillId: 'light_punch', reason: 'rushdown_mix' };
        return { intent: 'poke', skillId: 'medium_kick', reason: 'rushdown_kick' };
      }
      case 'turtle': {
        if (distance < 50) return { intent: 'retreat', skillId: null, reason: 'turtle_space' };
        if (distance > 120 && Math.random() < 0.45 && this._canAffordSkill(fighter, 'neon_orb')) {
          return { intent: 'poke', skillId: 'neon_orb', reason: 'turtle_zoning' };
        }
        if (oppAction?.phase === 'startup' && Math.random() < 0.3) {
          return { intent: 'block', skillId: 'guard', reason: 'turtle_defend' };
        }
        return { intent: 'block', skillId: 'guard', reason: 'turtle' };
      }
      case 'zoning': {
        if (distance > 120 && this._canAffordSkill(fighter, 'neon_orb')) {
          return { intent: 'poke', skillId: 'neon_orb', reason: 'zoning_orb' };
        }
        if (distance > 120) {
          return { intent: 'poke', skillId: 'medium_kick', reason: 'zoning_no_rage' };
        }
        if (distance < 60) {
          return { intent: 'retreat', skillId: 'back_dash', reason: 'zoning_backdash' };
        }
        return { intent: 'poke', skillId: 'medium_kick', reason: 'zoning_poke' };
      }
      case 'throw_mixup': {
        // Opponent guards too much — alternate throw and light attacks
        if (oppGuarding && distance < 45) {
          return { intent: 'throw', skillId: 'throw', reason: 'throw_mixup_guard' };
        }
        if (distance < 40 && Math.random() < 0.55) {
          return { intent: 'throw', skillId: 'throw', reason: 'throw_mixup' };
        }
        const roll = Math.random();
        if (roll < 0.5) return { intent: 'poke', skillId: 'light_punch', reason: 'throw_mixup_light' };
        if (roll < 0.75) return { intent: 'poke', skillId: 'medium_kick', reason: 'throw_mixup_kick' };
        return { intent: 'block', skillId: 'guard', reason: 'throw_mixup_wait' };
      }
      case 'bait_and_punish': {
        if (oppAction?.phase === 'startup') {
          return Math.random() < 0.65
            ? { intent: 'retreat', skillId: 'back_dash', reason: 'bait_back_dash' }
            : { intent: 'block', skillId: 'guard', reason: 'bait_guard' };
        }
        const roll = Math.random();
        if (roll < 0.5) return { intent: 'retreat', skillId: null, reason: 'bait' };
        if (roll < 0.8) return { intent: 'whiff_punish', skillId: 'heavy_strike', reason: 'punish_window' };
        return { intent: 'poke', skillId: 'medium_kick', reason: 'bait_kick' };
      }
      case 'counter_hit': {
        if (oppAction?.phase === 'startup' && distance < 60) {
          if (Math.random() < 0.25) {
            return { intent: 'block', skillId: 'parry', reason: 'counter_parry' };
          }
          return Math.random() < 0.7
            ? { intent: 'poke', skillId: 'light_punch', reason: 'counter_startup' }
            : { intent: 'poke', skillId: 'medium_kick', reason: 'counter_kick' };
        }
        return { intent: 'poke', skillId: 'light_punch', reason: 'counter_hit_setup' };
      }
      default: {
        // footsies — neutral spacing and pokes
        if (distance > 60) return { intent: 'approach', skillId: null, reason: 'footsies_close' };
        if (oppGuarding && distance < 38 && Math.random() < 0.35) {
          return { intent: 'throw', skillId: 'throw', reason: 'footsies_throw' };
        }
        const roll = Math.random();
        if (roll < 0.45) return { intent: 'poke', skillId: 'light_punch', reason: 'footsies' };
        if (roll < 0.75) return { intent: 'heavy_attack', skillId: 'heavy_strike', reason: 'footsies_mix' };
        return { intent: 'poke', skillId: 'medium_kick', reason: 'footsies_kick' };
      }
    }
  }

  _preferredDistance(style) {
    switch (style) {
      case 'rushdown':
      case 'snowball': return 45;
      case 'turtle': return 90;
      case 'bait_and_punish': return 70;
      case 'counter_hit': return 55;
      case 'zoning': return 125;
      default: return 65;
    }
  }
}
