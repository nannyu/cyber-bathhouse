/**
 * Server-authoritative combat engine scaffold.
 *
 * This first pass keeps the current bathhouse fighting UX working while
 * introducing rage, ultimates, high-level AI plans, and snapshots.
 */

import { SkillRegistry } from './SkillRegistry.js';
import { RageSystem } from './RageSystem.js';
import { AgentPolicyManager } from './AgentPolicyManager.js';
import { TacticalDirector } from './TacticalDirector.js';
import { ReactiveController } from './ReactiveController.js';

const ARENA_LIMITS = { minX: 160, maxX: 600, y: 330 };
const SPAWN_POSITIONS = {
  left: { x: 310, y: ARENA_LIMITS.y },
  right: { x: 450, y: ARENA_LIMITS.y },
};

export class CombatEngine {
  constructor({
    skillRegistry = new SkillRegistry(),
    rageSystem = new RageSystem(),
    policyManager = new AgentPolicyManager(),
  } = {}) {
    this.skillRegistry = skillRegistry;
    this.rageSystem = rageSystem;
    this.policyManager = policyManager;
    this.tacticalDirector = new TacticalDirector(policyManager);
    this.reactiveController = new ReactiveController(skillRegistry);
  }

  tickMatch(match, dt, users) {
    if (!match || match.finished) return [];

    match.frame += 1;
    this._tickCooldowns(match);
    this._syncFightersFromUsers(match, users);
    this._ensureArenaPositions(match, users);

    // Keep the first scaffold intentionally low-frequency. The frame engine
    // exists, while action cadence still resembles the old simple fight.
    const now = Date.now();
    if (match._lastAttackTime === 0) {
      match._lastAttackTime = now;
      return [];
    }
    if (now - match._lastAttackTime < 1200) {
      return [];
    }
    match._lastAttackTime = now;

    const attacker = users.get(match.attackerId);
    const defender = users.get(match.defenderId);
    if (!attacker || !defender) return [];

    return [this.applyExchange(match, attacker, defender)].filter(Boolean);
  }

  applyManualAttack(match, actor, users) {
    if (!match || !actor || match.finished) return null;
    this._ensureArenaPositions(match, users);
    const opponentId = match.getOpponentId(actor.id);
    const opponent = opponentId ? users.get(opponentId) : null;
    if (!opponent) return null;
    return this.applyExchange(match, actor, opponent);
  }

  applyExchange(match, actorUser, opponentUser) {
    const actor = match.getFighter(actorUser.id);
    const opponent = match.getFighter(opponentUser.id);
    if (!actor || !opponent) return null;

    const actorIntent = this.tacticalDirector.chooseIntent(match, actor, opponent);
    const opponentIntent = this.tacticalDirector.chooseIntent(match, opponent, actor);
    const actorAction = this.reactiveController.resolveAction(actorIntent, actor, opponent);
    const opponentAction = this.reactiveController.resolveAction(opponentIntent, opponent, actor);

    this._applyMovement(actor, actorAction);
    this._applyMovement(opponent, opponentAction);

    const actorResult = this._resolveSkill(match, actor, opponent, actorAction, opponentAction);
    const opponentResult = opponent.hp > 0
      ? this._resolveSkill(match, opponent, actor, opponentAction, actorAction)
      : { damage: 0, skillId: null, events: [] };

    actorUser.hp = actor.hp;
    opponentUser.hp = opponent.hp;
    actorUser.rage = actor.rage;
    opponentUser.rage = opponent.rage;
    actorUser.rageState = actor.rageState;
    opponentUser.rageState = opponent.rageState;
    this._syncUserPosition(actorUser, actor);
    this._syncUserPosition(opponentUser, opponent);

    const result = {
      fightId: match.id,
      attackerId: actorUser.id,
      defenderId: opponentUser.id,
      attackerName: actorUser.name,
      defenderName: opponentUser.name,
      attackerDamage: actorResult.damage,
      counterDamage: opponentResult.damage,
      attackerHp: actor.hp,
      defenderHp: opponent.hp,
      attackerRage: actor.rage,
      defenderRage: opponent.rage,
      attackerIntent: actorIntent.intent,
      defenderIntent: opponentIntent.intent,
      attackerSkillId: actorResult.skillId,
      defenderSkillId: opponentResult.skillId,
      events: [...actorResult.events, ...opponentResult.events],
      seed: match.seed,
      durationMs: Date.now() - match.startTime,
      finished: false,
    };

    if (opponent.hp <= 0 || actor.hp <= 0) {
      const winner = opponent.hp <= 0 ? actorUser : opponentUser;
      const loser = winner.id === actorUser.id ? opponentUser : actorUser;
      match.finish(winner.id, loser.id);
      result.finished = true;
      result.winnerId = winner.id;
      result.loserId = loser.id;
      result.winnerName = winner.name;
      result.loserName = loser.name;
    }

    return result;
  }

  _resolveSkill(match, actor, opponent, action, defenderAction = null) {
    if (action.type !== 'skill' || !action.skill) {
      actor.actionState = action.type || 'idle';
      actor.lastIntent = action.type || 'idle';
      return { damage: 0, skillId: null, events: [] };
    }

    const skill = action.skill;
    const events = [];
    let damage = skill.damage || 0;

    if (skill.kind === 'ultimate') {
      if (!this.rageSystem.spendUltimate(actor, skill.rageCost || 100)) {
        return { damage: 0, skillId: null, events };
      }
      events.push(match.recordEvent('ultimate:cast', {
        fighterId: actor.userId,
        ultimateId: skill.id,
        cinematic: !!skill.cinematic,
      }));
    }

    const hitbox = this._getWorldHitbox(actor, skill);
    const hurtbox = this._getWorldHurtbox(opponent);
    const didHit = this._rectsOverlap(hitbox, hurtbox);

    if (!didHit) {
      actor.actionState = 'recovery';
      actor.currentSkillId = skill.id;
      actor.cooldowns[skill.id] = skill.cooldownFrames || 10;
      events.push(match.recordEvent('skill:whiff', {
        from: actor.userId,
        skillId: skill.id,
        hitbox,
        targetHurtbox: hurtbox,
      }));
      return { damage: 0, skillId: skill.id, events };
    }

    const canBlock = defenderAction?.type === 'defend' && skill.canBeBlocked !== false;
    if (canBlock) {
      damage = Math.max(0, skill.guardDamage || 0);
      opponent.hp = Math.max(0, opponent.hp - damage);
      opponent.guardFrames = skill.blockstunFrames || 7;
      actor.actionState = 'recovery';
      actor.currentSkillId = skill.id;
      actor.cooldowns[skill.id] = skill.cooldownFrames || 10;

      const gainedByVictim = this.rageSystem.gainFromDamageTaken(opponent, damage, { blocked: true });
      events.push(match.recordEvent('skill:block', {
        from: actor.userId,
        to: opponent.userId,
        skillId: skill.id,
        blockedDamage: damage,
        targetHp: opponent.hp,
        rageGain: gainedByVictim,
        hitbox,
        targetHurtbox: hurtbox,
      }));
      this._recordRageReady(match, opponent, events);
      return { damage, skillId: skill.id, events };
    }

    opponent.hp = Math.max(0, opponent.hp - damage);
    opponent.stunFrames = skill.hitstunFrames || 8;
    opponent.comboCounter = (opponent.comboCounter || 0) + 1;
    actor.actionState = 'recovery';
    actor.currentSkillId = skill.id;
    actor.cooldowns[skill.id] = skill.cooldownFrames || 10;

    const gainedByVictim = this.rageSystem.gainFromDamageTaken(opponent, damage);
    const gainedByActor = this.rageSystem.gainFromDamageDealt(actor, damage);

    events.push(match.recordEvent(skill.kind === 'ultimate' ? 'ultimate:hit' : 'skill:hit', {
      from: actor.userId,
      to: opponent.userId,
      skillId: skill.id,
      damage,
      targetHp: opponent.hp,
      targetX: opponent.x,
      targetY: opponent.y,
      hitbox,
      targetHurtbox: hurtbox,
    }));
    if (gainedByVictim > 0) {
      events.push(match.recordEvent('rage:gain', {
        fighterId: opponent.userId,
        amount: gainedByVictim,
        rage: opponent.rage,
        reason: 'damage_taken',
      }));
    }
    if (gainedByActor > 0) {
      events.push(match.recordEvent('rage:gain', {
        fighterId: actor.userId,
        amount: gainedByActor,
        rage: actor.rage,
        reason: 'damage_dealt',
      }));
    }
    this._recordRageReady(match, opponent, events);
    this._recordRageReady(match, actor, events);

    return { damage, skillId: skill.id, events };
  }

  _applyMovement(fighter, action) {
    if (action.type !== 'move') return;
    fighter.x = Math.max(ARENA_LIMITS.minX, Math.min(ARENA_LIMITS.maxX, fighter.x + action.dx));
    fighter.actionState = 'walking';
  }

  _getWorldHitbox(fighter, skill) {
    const box = skill.hitbox || { x: 16, y: -42, width: 32, height: 28 };
    const width = box.width ?? box.w ?? 0;
    const height = box.height ?? box.h ?? 0;
    const localX = box.x || 0;
    const x = fighter.facing >= 0
      ? fighter.x + localX
      : fighter.x - localX - width;
    return {
      x: Math.round(x),
      y: Math.round(fighter.y + (box.y || 0)),
      width,
      height,
    };
  }

  _getWorldHurtbox(fighter) {
    const box = fighter.hurtbox || { x: -14, y: -50, width: 28, height: 50 };
    return {
      x: Math.round(fighter.x + (box.x || 0)),
      y: Math.round(fighter.y + (box.y || 0)),
      width: box.width ?? box.w ?? 0,
      height: box.height ?? box.h ?? 0,
    };
  }

  _rectsOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  _syncUserPosition(user, fighter) {
    user.x = fighter.x;
    user.y = fighter.y;
    user.targetX = fighter.x;
    user.targetY = fighter.y;
  }

  _recordRageReady(match, fighter, events) {
    if (fighter.rage < 100 || fighter._ultimateReadyAnnounced) return;
    fighter._ultimateReadyAnnounced = true;
    events.push(match.recordEvent('ultimate:ready', {
      fighterId: fighter.userId,
      rage: fighter.rage,
    }));
  }

  _tickCooldowns(match) {
    for (const fighter of Object.values(match.fighters)) {
      for (const [skillId, frames] of Object.entries(fighter.cooldowns)) {
        fighter.cooldowns[skillId] = Math.max(0, frames - 1);
      }
      fighter.stunFrames = Math.max(0, (fighter.stunFrames || 0) - 1);
      fighter.guardFrames = Math.max(0, (fighter.guardFrames || 0) - 1);
      fighter.stateFrame += 1;
    }
  }

  _syncFightersFromUsers(match, users) {
    for (const fighter of Object.values(match.fighters)) {
      const user = users.get(fighter.userId);
      if (!user) continue;
      fighter.hp = user.hp;
      if (user.fightId !== match.id || match.frame <= 1) {
        fighter.x = Math.round(user.x);
      }
      fighter.y = ARENA_LIMITS.y;
      fighter.facing = fighter.userId === match.attackerId ? 1 : -1;
    }
  }

  _ensureArenaPositions(match, users) {
    if (match._arenaPositioned) return;
    const left = match.getFighter(match.attackerId);
    const right = match.getFighter(match.defenderId);
    const leftUser = users.get(match.attackerId);
    const rightUser = users.get(match.defenderId);
    if (!left || !right || !leftUser || !rightUser) return;

    Object.assign(left, SPAWN_POSITIONS.left, { facing: 1 });
    Object.assign(right, SPAWN_POSITIONS.right, { facing: -1 });
    this._syncUserPosition(leftUser, left);
    this._syncUserPosition(rightUser, right);
    match._arenaPositioned = true;
  }
}
