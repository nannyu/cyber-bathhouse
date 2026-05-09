/**
 * Low-latency reaction layer. This runs locally and never waits on an LLM.
 */

const ARENA_LIMITS = { minX: 160, maxX: 600 };

export class ReactiveController {
  constructor(skillRegistry) {
    this.skillRegistry = skillRegistry;
  }

  resolveAction({ intent, skillId }, fighter, opponent) {
    if (!fighter || !opponent) {
      return { type: 'idle', skill: null };
    }

    if (fighter.stunFrames > 0) {
      return { type: 'stunned', skill: null };
    }

    // Movement intents
    if (intent === 'approach') {
      const distance = Math.abs(opponent.x - fighter.x);
      const speed = distance > 60 ? 28 : 20;
      return { type: 'move', dx: fighter.facing * speed, skill: null };
    }

    if (intent === 'retreat') {
      return { type: 'move', dx: -fighter.facing * 10, skill: null };
    }

    if (intent === 'escape_corner') {
      // Move away from nearest arena edge
      const nearLeft = fighter.x < ARENA_LIMITS.minX + 40;
      const nearRight = fighter.x > ARENA_LIMITS.maxX - 40;
      if (nearLeft) return { type: 'move', dx: 20, skill: null };
      if (nearRight) return { type: 'move', dx: -20, skill: null };
      return { type: 'move', dx: -fighter.facing * 12, skill: null };
    }

    // Resolve skill
    let skill = skillId ? this.skillRegistry.get(skillId) : this.skillRegistry.getDefaultAttack();
    if (!skill) {
      return { type: 'idle', skill: null };
    }

    // Combo confirm: opponent is stunned → upgrade to heavy if available
    const opponentStunned = (opponent.stunFrames || 0) > 0;
    if (opponentStunned && skill.id === 'light_punch') {
      const heavy = this.skillRegistry.get('heavy_strike');
      if (heavy && (fighter.cooldowns?.['heavy_strike'] || 0) <= 0) {
        skill = heavy;
      }
    }

    const cooldown = fighter.cooldowns?.[skill.id] || 0;
    if (cooldown > 0) {
      // Skill on cooldown — move instead of standing still
      const distance = Math.abs(opponent.x - fighter.x);
      if (distance > 55) {
        return { type: 'move', dx: fighter.facing * 16, skill: null };
      }
      return { type: 'idle', skill: null };
    }

    if (skill.rageCost && fighter.rage < skill.rageCost) {
      return { type: 'idle', skill: null };
    }

    // Range check: can this skill reach the opponent?
    if (skill.hitbox && !this._inRange(fighter, opponent, skill)) {
      const distance = Math.abs(opponent.x - fighter.x);
      const speed = distance > 60 ? 24 : 16;
      return { type: 'move', dx: fighter.facing * speed, skill: null };
    }

    return { type: skill.kind === 'defense' ? 'defend' : 'skill', skill };
  }

  /**
   * Check if a skill can reach the opponent from current distance.
   */
  _inRange(fighter, opponent, skill) {
    if (!skill.hitbox) return true;
    const distance = Math.abs(opponent.x - fighter.x);
    // hitbox reach: local offset + width + half opponent hurtbox (14px)
    const reach = (skill.hitbox.x || 0) + (skill.hitbox.width || 0) + 14;
    return distance <= reach + 4; // 4px buffer
  }
}
