/**
 * Data-driven combat skill registry.
 */

export const DEFAULT_SKILLS = {
  light_punch: {
    id: 'light_punch',
    name: 'Neon Jab',
    kind: 'normal',
    startupFrames: 4,
    activeFrames: 3,
    recoveryFrames: 8,
    damage: 7,
    guardDamage: 1,
    hitbox: { x: 18, y: -42, width: 32, height: 26 },
    rageCost: 0,
    cooldownFrames: 10,
    hitstunFrames: 14,
    blockstunFrames: 7,
    tags: ['poke', 'confirm_starter'],
  },
  heavy_strike: {
    id: 'heavy_strike',
    name: 'Steam Hammer',
    kind: 'normal',
    startupFrames: 9,
    activeFrames: 4,
    recoveryFrames: 18,
    damage: 13,
    guardDamage: 3,
    hitbox: { x: 22, y: -46, width: 46, height: 34 },
    rageCost: 0,
    cooldownFrames: 24,
    hitstunFrames: 18,
    blockstunFrames: 11,
    tags: ['punish', 'high_commitment'],
  },
  medium_kick: {
    id: 'medium_kick',
    name: 'Neon Roundhouse',
    kind: 'normal',
    startupFrames: 6,
    activeFrames: 3,
    recoveryFrames: 12,
    damage: 10,
    guardDamage: 2,
    hitbox: { x: 20, y: -48, width: 42, height: 30 },
    rageCost: 0,
    cooldownFrames: 16,
    hitstunFrames: 14,
    blockstunFrames: 9,
    tags: ['poke', 'spacing'],
  },
  throw: {
    id: 'throw',
    name: 'Cyber Grapple',
    kind: 'throw',
    startupFrames: 5,
    activeFrames: 2,
    recoveryFrames: 16,
    damage: 12,
    guardDamage: 0,
    hitbox: { x: 8, y: -40, width: 28, height: 36 },
    rageCost: 0,
    cooldownFrames: 30,
    hitstunFrames: 16,
    blockstunFrames: 0,
    canBeBlocked: false,
    tags: ['throw', 'mixup'],
  },
  guard: {
    id: 'guard',
    name: 'Chrome Guard',
    kind: 'defense',
    startupFrames: 1,
    activeFrames: 12,
    recoveryFrames: 4,
    damage: 0,
    guardDamage: 0,
    rageCost: 0,
    cooldownFrames: 8,
    tags: ['defense'],
  },
  neon_overdrive: {
    id: 'neon_overdrive',
    name: 'Neon Overdrive',
    kind: 'ultimate',
    startupFrames: 12,
    activeFrames: 6,
    recoveryFrames: 30,
    damage: 35,
    minDamage: 18,
    guardDamage: 8,
    hitbox: { x: 16, y: -58, width: 92, height: 54 },
    rageCost: 100,
    cooldownFrames: 90,
    canBeBlocked: true,
    canBeInterrupted: true,
    cinematic: true,
    tags: ['cinematic_super', 'kill_confirm'],
  },
  steam_reversal: {
    id: 'steam_reversal',
    name: 'Steam Reversal',
    kind: 'ultimate',
    startupFrames: 5,
    activeFrames: 5,
    recoveryFrames: 36,
    damage: 28,
    minDamage: 14,
    guardDamage: 5,
    hitbox: { x: 10, y: -54, width: 72, height: 50 },
    rageCost: 100,
    cooldownFrames: 100,
    invulnFrames: 4,
    canBeBlocked: true,
    canBeInterrupted: false,
    cinematic: false,
    tags: ['reversal_super', 'comeback'],
  },
};

export class SkillRegistry {
  constructor(skills = DEFAULT_SKILLS) {
    this._skills = new Map(Object.entries(skills));
  }

  get(skillId) {
    return this._skills.get(skillId) || null;
  }

  list() {
    return [...this._skills.values()];
  }

  getDefaultAttack() {
    return this.get('light_punch');
  }

  getDefaultUltimate(policy = 'confirm_only') {
    if (policy === 'reversal_when_low') {
      return this.get('steam_reversal');
    }
    return this.get('neon_overdrive');
  }
}
