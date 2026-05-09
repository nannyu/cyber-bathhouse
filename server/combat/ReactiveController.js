/**
 * Low-latency reaction layer. This runs locally and never waits on an LLM.
 */

import { CONFIG } from '../config.js';

const ARENA_LIMITS = CONFIG.ARENA_FIGHT.combatLimits;

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
      // 接近时带有轻微垂直位移，向对手Y方向靠拢
      const yDiff = opponent.y - fighter.y;
      const dy = Math.abs(yDiff) > 8 ? Math.sign(yDiff) * Math.min(Math.abs(yDiff) * 0.4, 12) : 0;
      return { type: 'move', dx: fighter.facing * speed, dy, skill: null };
    }

    if (intent === 'retreat') {
      // 后退时随机加一点垂直闪避
      const dy = (Math.random() - 0.5) * 14;
      return { type: 'move', dx: -fighter.facing * 18, dy, skill: null };
    }

    if (intent === 'feint') {
      const dir = fighter.facing * (Math.random() < 0.5 ? 1 : -1);
      // 假动作带垂直方向晃动
      const dy = (Math.random() - 0.5) * 16;
      return { type: 'move', dx: dir * 12, dy, skill: null };
    }

    if (intent === 'sidestep') {
      // 纯垂直闪避（新增意图）
      const dy = (Math.random() < 0.5 ? -1 : 1) * 20;
      return { type: 'move', dx: 0, dy, skill: null };
    }

    if (intent === 'crouch') {
      // 蹲下 — 缩小受击框，准备下段攻击
      return { type: 'crouch', dx: 0, dy: 0, skill: null };
    }

    if (intent === 'jump') {
      // 跳跃 — 向前跳跃接近对手
      const dx = fighter.facing * 16;
      return { type: 'jump', dx, dy: 0, skill: null };
    }

    if (intent === 'crouch_attack') {
      // 蹲下攻击（下段扫腿）
      const skill = this.skillRegistry.get('crouch_kick');
      if (skill && (fighter.cooldowns?.['crouch_kick'] || 0) <= 0) {
        return { type: 'skill', skill };
      }
      return { type: 'crouch', dx: 0, dy: 0, skill: null };
    }

    if (intent === 'jump_attack') {
      // 跳跃攻击（空中踢）
      const skill = this.skillRegistry.get('jump_kick');
      if (skill && (fighter.cooldowns?.['jump_kick'] || 0) <= 0) {
        return { type: 'skill', skill };
      }
      return { type: 'jump', dx: fighter.facing * 12, dy: 0, skill: null };
    }

    if (intent === 'escape_corner') {
      // Move away from nearest arena edge
      const nearLeft = fighter.x < ARENA_LIMITS.minX + 40;
      const nearRight = fighter.x > ARENA_LIMITS.maxX - 40;
      // 逃离角落时也加垂直位移
      const dy = (Math.random() - 0.5) * 18;
      if (nearLeft) return { type: 'move', dx: 20, dy, skill: null };
      if (nearRight) return { type: 'move', dx: -20, dy, skill: null };
      return { type: 'move', dx: -fighter.facing * 12, dy, skill: null };
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
      // Skill on cooldown — always move instead of standing still
      const distance = Math.abs(opponent.x - fighter.x);
      const dy = (Math.random() - 0.5) * 10;
      if (distance > 55) {
        return { type: 'move', dx: fighter.facing * 16, dy, skill: null };
      }
      const dir = Math.random() < 0.5 ? 1 : -1;
      return { type: 'move', dx: dir * 12, dy, skill: null };
    }

    if (skill.rageCost && fighter.rage < skill.rageCost) {
      return { type: 'idle', skill: null };
    }

    if (skill.kind === 'motion') {
      const motion = skill.motionPath;
      if (motion === 'forward_dash') {
        return { type: 'move', dx: fighter.facing * 24, dy: 0, skill: null };
      }
      if (motion === 'back_step') {
        const dy = (Math.random() - 0.5) * 12;
        return { type: 'move', dx: -fighter.facing * 22, dy, skill: null };
      }
    }

    // Range check: melee / throws only — projectiles zone from distance
    if (skill.kind !== 'projectile' && skill.hitbox && !this._inRange(fighter, opponent, skill)) {
      const distance = Math.abs(opponent.x - fighter.x);
      const speed = distance > 60 ? 24 : 16;
      const yDiff = opponent.y - fighter.y;
      const dy = Math.abs(yDiff) > 8 ? Math.sign(yDiff) * Math.min(Math.abs(yDiff) * 0.3, 10) : 0;
      return { type: 'move', dx: fighter.facing * speed, dy, skill: null };
    }

    return { type: skill.kind === 'defense' ? 'defend' : 'skill', skill };
  }

  /**
   * Check if a skill can reach the opponent from current distance.
   */
  _inRange(fighter, opponent, skill) {
    if (!skill.hitbox) return true;
    const distX = Math.abs(opponent.x - fighter.x);
    const distY = Math.abs(opponent.y - fighter.y);
    // hitbox reach: local offset + width + half opponent hurtbox (14px)
    const reach = (skill.hitbox.x || 0) + (skill.hitbox.width || 0) + 14;
    // 垂直方向也需要在攻击范围内（hurtbox 高度 50px）
    return distX <= reach + 4 && distY <= 50;
  }
}
