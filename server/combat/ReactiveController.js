/**
 * Low-latency reaction layer. This runs locally and never waits on an LLM.
 */

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

    if (intent === 'approach') {
      return { type: 'move', dx: fighter.facing * 18, skill: null };
    }

    if (intent === 'retreat') {
      return { type: 'move', dx: -fighter.facing * 18, skill: null };
    }

    const skill = skillId ? this.skillRegistry.get(skillId) : this.skillRegistry.getDefaultAttack();
    if (!skill) {
      return { type: 'idle', skill: null };
    }

    const cooldown = fighter.cooldowns?.[skill.id] || 0;
    if (cooldown > 0) {
      return { type: 'idle', skill: null };
    }

    if (skill.rageCost && fighter.rage < skill.rageCost) {
      return { type: 'idle', skill: null };
    }

    return { type: skill.kind === 'defense' ? 'defend' : 'skill', skill };
  }
}
