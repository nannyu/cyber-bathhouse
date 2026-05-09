/**
 * Server-authoritative combat engine with frame-level simulation.
 *
 * Each tick (50ms @ 20Hz) advances one frame:
 *   1. Update frame states (cooldowns, stun, skill phases)
 *   2. Fighters that can act choose new actions
 *   3. Check hits (active-phase skills vs opponent hurtboxes)
 *   4. Sync fighter states back to user objects
 */

import { SkillRegistry } from './SkillRegistry.js';
import { RageSystem } from './RageSystem.js';
import { AgentPolicyManager } from './AgentPolicyManager.js';
import { TacticalDirector } from './TacticalDirector.js';
import { ReactiveController } from './ReactiveController.js';
import { OpponentProfile } from './OpponentProfile.js';
import { ACTION_STATES } from './ActionStates.js';
import { CONFIG } from '../config.js';

const ARENA_LIMITS = CONFIG.ARENA_FIGHT.combatLimits;
const SPAWN_POSITIONS = {
  left: { x: CONFIG.ARENA_FIGHT.leftSpawn.x, y: CONFIG.ARENA_FIGHT.leftSpawn.y },
  right: { x: CONFIG.ARENA_FIGHT.rightSpawn.x, y: CONFIG.ARENA_FIGHT.rightSpawn.y },
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

    /** @type {Map<string, OpponentProfile>} fighterId → profile of their opponent */
    this._profiles = new Map();
  }

  /**
   * Tick one frame of combat simulation (called at 20Hz from World.tick).
   * @param {FightMatch} match
   * @param {Map<string, User>} users
   * @returns {Array<Object>} - Array of frame results (empty if nothing notable)
   */
  tickMatch(match, users) {
    if (!match || match.finished) return [];

    match.frame += 1;

    // Position fighters in arena on first tick
    this._ensureArenaPositions(match, users);

    const arenaY = ARENA_LIMITS.y;
    for (const fighter of Object.values(match.fighters)) {
      fighter.y = arenaY;
    }

    const events = [];

    // 1. Advance frame states: cooldowns, stun, guard, skill phases
    this._tickFrameStates(match);

    // Face opponent before choosing movement (uses positions after knockback drift)
    this._syncFacingToOpponents(match);

    // 2. Fighters that can act choose and execute new actions
    this._executeActions(match, users);

    // Sprite / hitbox facing after footsies movement (stunned fighters still turn visually)
    this._syncFacingToOpponents(match);

    // 3. Check hits: active-phase skills vs opponent hurtboxes
    const hitResults = this._checkHits(match, events);
    this._tickProjectiles(match, events);

    // 4. Update opponent behavior profiles
    this._updateProfiles(match);

    // 5. Adapt strategy every 60 frames (~3s)
    if (match.frame % 60 === 0) {
      this._adaptStrategies(match);
    }

    // 6. Sync fighter state back to user objects
    this._syncFightersToUsers(match, users);

    // 7. Check if anyone is KO'd
    const finished = this._checkFightEnd(match, users, events);

    // 8. Build result if anything notable happened this frame
    if (finished || hitResults.length > 0 || events.length > 0) {
      return [this._buildResult(match, hitResults, events, finished)];
    }

    return [];
  }

  /**
   * Queue a manual attack intent for the next tick.
   * @deprecated Immediate attack is no longer supported; use intent queue + tickMatch.
   */
  applyManualAttack(match, actor, _users) {
    if (!match || !actor || match.finished) return null;
    this.policyManager.queueIntent(actor.id, {
      intent: 'combo_confirm',
      skillId: 'light_punch',
    });
    return { success: true, queued: true };
  }

  /**
   * @deprecated Use tickMatch instead.
   */
  applyExchange(_match, _actor, _opponent) {
    return null;
  }

  // ─── Frame State Management ───────────────────────────────────────

  _tickFrameStates(match) {
    for (const fighter of Object.values(match.fighters)) {
      const prevStun = fighter.stunFrames || 0;
      const prevGuard = fighter.guardFrames || 0;

      // Decrement stun / guard counters
      fighter.stunFrames = Math.max(0, prevStun - 1);
      fighter.guardFrames = Math.max(0, prevGuard - 1);

      // 受击/格挡硬直结束后重置「连招段」怒气上限计数，否则整场只会吃到前几下的挨打怒气
      if (prevStun > 0 && fighter.stunFrames === 0) {
        this.rageSystem.resetComboGain(fighter);
      }
      if (prevGuard > 0 && fighter.guardFrames === 0) {
        this.rageSystem.resetComboGain(fighter);
      }

      // Decrement skill cooldowns
      for (const [skillId, frames] of Object.entries(fighter.cooldowns || {})) {
        fighter.cooldowns[skillId] = Math.max(0, frames - 1);
      }

      // Advance current action phase: startup -> active -> recovery -> idle
      if (fighter.currentAction) {
        const action = fighter.currentAction;
        action.frame += 1;
        fighter.phase = action.phase;
        fighter.phaseFrame = action.frame;
        fighter.currentSkillId = action.skill?.id ?? null;
        const skill = action.skill;

        if (action.phase === 'startup') {
          if (action.frame >= (skill?.startupFrames || 0)) {
            action.phase = 'active';
            action.frame = 0;
          }
        } else if (action.phase === 'active') {
          if (action.frame >= (skill?.activeFrames || 0)) {
            action.phase = 'recovery';
            action.frame = 0;
          }
        } else if (action.phase === 'recovery') {
          if (action.frame >= (skill?.recoveryFrames || 0)) {
            // Action complete
            fighter.currentAction = null;
            fighter.phase = null;
            fighter.phaseFrame = 0;
            fighter.currentSkillId = null;
            if (skill) {
              fighter.cooldowns[skill.id] = skill.cooldownFrames || 0;
            }
            fighter.actionState = ACTION_STATES.IDLE;
          }
        }
      }

      if (!fighter.currentAction) {
        fighter.phase = null;
        fighter.phaseFrame = 0;
        fighter.currentSkillId = null;
      }

      if (Math.abs(fighter.vx || 0) > 0.05) {
        fighter.x += fighter.vx;
        fighter.vx *= 0.85;
      } else {
        fighter.vx = 0;
      }
      this._applyArenaBoundsX(fighter);

      fighter.stateFrame = (fighter.stateFrame || 0) + 1;
    }

  }

  _canAct(fighter) {
    if ((fighter.stunFrames || 0) > 0) return false;
    if (fighter.currentAction) {
      const phase = fighter.currentAction.phase;
      if (phase === 'startup' || phase === 'active' || phase === 'recovery') {
        return false;
      }
    }
    return true;
  }

  // ─── Action Selection & Execution ─────────────────────────────────

  /** Everyone faces the opponent each frame (not only when _canAct). */
  _syncFacingToOpponents(match) {
    const EPS = 0.5;
    for (const fighter of Object.values(match.fighters)) {
      const opponent = match.getOpponent(fighter.userId);
      if (!opponent) continue;
      const dx = opponent.x - fighter.x;
      if (dx > EPS) fighter.facing = 1;
      else if (dx < -EPS) fighter.facing = -1;
      else fighter.facing = fighter.side === 'left' ? 1 : -1;
    }
  }

  _executeActions(match, users) {
    for (const fighter of Object.values(match.fighters)) {
      if (!this._canAct(fighter)) continue;

      const opponent = match.getOpponent(fighter.userId);

      // Apply fighter's personality if no plan exists
      const user = users.get(fighter.userId);
      if (user?.combatPersonality) {
        const currentPlan = this.policyManager.getPlan(fighter.userId);
        if (currentPlan.style === 'footsies' && !this.policyManager._queuedIntents.has(fighter.userId)) {
          this.policyManager.setPlan(fighter.userId, {
            ...user.combatPersonality,
            expiresAt: Date.now() + 30000,
          });
        }
      }

      // TacticalDirector consumes queued intents first, then decides
      const intent = this.tacticalDirector.chooseIntent(match, fighter, opponent);
      const action = this.reactiveController.resolveAction(intent, fighter, opponent);

      if (action.type === 'move') {
        fighter.x += action.dx;
        // Prevent passing through opponent
        if (opponent) {
          const minDist = 16;
          if (fighter.facing > 0 && fighter.x > opponent.x - minDist) {
            fighter.x = opponent.x - minDist;
          } else if (fighter.facing < 0 && fighter.x < opponent.x + minDist) {
            fighter.x = opponent.x + minDist;
          }
        }
        this._applyArenaBoundsX(fighter, action.dx);
        fighter.actionState = Math.abs(action.dx) >= 20 ? ACTION_STATES.DASH : ACTION_STATES.WALK;
        fighter.lastIntent = action.dx > 0 ? 'approach' : 'retreat';
      } else if (action.type === 'skill' || action.type === 'defend') {
        this._startSkillAction(fighter, action, match);
      } else {
        fighter.actionState = action.type || ACTION_STATES.IDLE;
        fighter.lastIntent = action.type || 'idle';
      }
      fighter.idleFramesCounter = fighter.actionState === ACTION_STATES.IDLE
        ? (fighter.idleFramesCounter || 0) + 1
        : 0;

      // Record this action in the opponent's profile
      if (opponent) {
        const profileKey = `${match.id}:${opponent.userId}`;
        let profile = this._profiles.get(profileKey);
        if (!profile) {
          profile = new OpponentProfile();
          this._profiles.set(profileKey, profile);
        }
        const skillId = action.skill?.id || null;
        profile.recordAction(action.type, skillId);
      }
    }
  }

  _startSkillAction(fighter, action, match) {
    const skill = action.skill;
    if (!skill) return;

    fighter.currentAction = {
      type: action.type,
      skill,
      phase: 'startup',
      frame: 0,
      startedAt: match.frame,
    };
    fighter.actionState = action.type === 'defend' ? ACTION_STATES.GUARD : ACTION_STATES.ATTACK;
    fighter.lastIntent = skill.id;
    fighter.currentSkillId = skill.id;
    fighter.phase = 'startup';
    fighter.phaseFrame = 0;

    if (skill.kind === 'projectile') {
      this._spawnProjectile(match, fighter, skill);
    }
  }

  // ─── Hit Detection ────────────────────────────────────────────────

  _checkHits(match, events) {
    const hitResults = [];

    for (const fighter of Object.values(match.fighters)) {
      const action = fighter.currentAction;
      // Only check on the first frame of active phase
      if (!action || action.phase !== 'active' || action.frame !== 0) continue;

      const skill = action.skill;
      if (!skill || skill.kind === 'defense') continue;

      const opponent = match.getOpponent(fighter.userId);
      if (!opponent) continue;

      const hitbox = this._getWorldHitbox(fighter, skill);
      const hurtbox = this._getWorldHurtbox(opponent);

      if (!this._rectsOverlap(hitbox, hurtbox)) {
        // Whiff — active phase continues, may hit next frame
        events.push(match.recordEvent('skill:whiff', {
          from: fighter.userId,
          skillId: skill.id,
          hitbox,
          targetHurtbox: hurtbox,
        }));
        continue;
      }

      // Hit!
      const result = this._resolveHit(match, fighter, opponent, skill, events);
      hitResults.push(result);
    }

    return hitResults;
  }

  _resolveHit(match, attacker, defender, skill, events) {
    let damage = skill.damage || 0;
    let blocked = false;

    // Check if defender is guarding (throws bypass guard)
    const defenderGuarding = defender.currentAction?.type === 'defend'
      && defender.currentAction.phase === 'active'
      && skill.canBeBlocked !== false
      && skill.kind !== 'throw';

    if (defenderGuarding) {
      // Blocked
      damage = Math.max(0, skill.guardDamage || 0);
      defender.hp = Math.max(0, defender.hp - damage);
      defender.guardFrames = skill.blockstunFrames || 7;
      defender.actionState = ACTION_STATES.BLOCKSTUN;
      blocked = true;

      const gained = this.rageSystem.gainFromDamageTaken(defender, damage, { blocked: true });
      events.push(match.recordEvent('skill:block', {
        from: attacker.userId,
        to: defender.userId,
        skillId: skill.id,
        blockedDamage: damage,
        targetHp: defender.hp,
        rageGain: gained,
      }));

      if (gained > 0) {
        events.push(match.recordEvent('rage:gain', {
          fighterId: defender.userId,
          amount: gained,
          rage: defender.rage,
          reason: 'blocked_damage',
        }));
      }
      this._recordRageReady(match, defender, events);
    } else {
      // Clean hit
      defender.hp = Math.max(0, defender.hp - damage);
      defender.stunFrames = skill.hitstunFrames || 8;
      defender.actionState = ACTION_STATES.HITSTUN;
      defender.comboCounter = (defender.comboCounter || 0) + 1;
      defender.vx = (skill.knockback?.x || 10) * (attacker.facing || 1);
      defender.velocityFrames = skill.hitstunFrames || 8;

      // Defender's current action is interrupted
      if (defender.currentAction) {
        defender.currentAction = null;
      }

      const gainedVictim = this.rageSystem.gainFromDamageTaken(defender, damage);
      const gainedAttacker = this.rageSystem.gainFromDamageDealt(attacker, damage);

      const eventType = skill.kind === 'ultimate' ? 'ultimate:hit' : 'skill:hit';
      events.push(match.recordEvent(eventType, {
        from: attacker.userId,
        to: defender.userId,
        skillId: skill.id,
        damage,
        targetHp: defender.hp,
        targetX: defender.x,
        targetY: defender.y,
        hitX: Math.round((attacker.x + defender.x) / 2),
        hitY: Math.round((attacker.y + defender.y) / 2 - 24),
        hitSpark: skill.hitSpark || 'small',
      }));

      if (gainedVictim > 0) {
        events.push(match.recordEvent('rage:gain', {
          fighterId: defender.userId,
          amount: gainedVictim,
          rage: defender.rage,
          reason: 'damage_taken',
        }));
      }
      if (gainedAttacker > 0) {
        events.push(match.recordEvent('rage:gain', {
          fighterId: attacker.userId,
          amount: gainedAttacker,
          rage: attacker.rage,
          reason: 'damage_dealt',
        }));
      }
      this._recordRageReady(match, defender, events);
      this._recordRageReady(match, attacker, events);
    }

    // Attacker enters recovery immediately after hit
    if (attacker.currentAction) {
      attacker.currentAction.phase = 'recovery';
      attacker.currentAction.frame = 0;
    }

    return {
      attackerId: attacker.userId,
      defenderId: defender.userId,
      damage,
      blocked,
      skillId: skill.id,
    };
  }

  // ─── Fight End & Result Building ──────────────────────────────────

  _checkFightEnd(match, users, events) {
    for (const fighter of Object.values(match.fighters)) {
      if (fighter.hp <= 0) {
        const opponent = match.getOpponent(fighter.userId);
        const winnerId = opponent?.userId;
        const loserId = fighter.userId;
        match.finish(winnerId, loserId);

        const winner = users.get(winnerId);
        const loser = users.get(loserId);
        events.push(match.recordEvent('fight:ko', {
          winnerId,
          loserId,
          winnerName: winner?.name || opponent?.name,
          loserName: loser?.name || fighter.name,
        }));
        return true;
      }
    }
    return false;
  }

  _buildResult(match, hitResults, events, finished) {
    const attacker = match.getFighter(match.attackerId);
    const defender = match.getFighter(match.defenderId);

    // Merge hit results into attacker/defender damage
    let attackerDamage = 0;
    let defenderDamage = 0;
    let attackerSkillId = null;
    let defenderSkillId = null;

    for (const hr of hitResults) {
      if (hr.attackerId === match.attackerId) {
        attackerDamage = hr.damage;
        attackerSkillId = hr.skillId;
      } else {
        defenderDamage = hr.damage;
        defenderSkillId = hr.skillId;
      }
    }

    return {
      fightId: match.id,
      attackerId: match.attackerId,
      defenderId: match.defenderId,
      attackerName: match.attackerName,
      defenderName: match.defenderName,
      attackerDamage,
      counterDamage: defenderDamage,
      attackerHp: attacker?.hp ?? 100,
      defenderHp: defender?.hp ?? 100,
      attackerRage: attacker?.rage ?? 0,
      defenderRage: defender?.rage ?? 0,
      attackerSkillId,
      defenderSkillId,
      attackerIntent: attacker?.lastIntent || 'neutral',
      defenderIntent: defender?.lastIntent || 'neutral',
      events,
      finished,
      winnerId: finished ? match.winnerId : null,
      loserId: finished ? match.loserId : null,
      winnerName: finished
        ? (attacker?.userId === match.winnerId ? attacker?.name : defender?.name)
        : null,
      loserName: finished
        ? (attacker?.userId === match.loserId ? attacker?.name : defender?.name)
        : null,
      durationMs: Date.now() - match.startTime,
      seed: match.seed,
    };
  }

  // ─── Positioning ──────────────────────────────────────────────────

  /**
   * 限制格斗水平位置在擂台内；撞侧绳时给轻微反弹（击退用 vx 反向衰减，走位用 wallWalkKick）。
   * @param {object} fighter
   * @param {number|undefined} moveDx — 本帧战术走位位移（sign 与 vx 无关）
   */
  _applyArenaBoundsX(fighter, moveDx = undefined) {
    const minX = ARENA_LIMITS.minX;
    const maxX = ARENA_LIMITS.maxX;
    const bounce = CONFIG.ARENA_FIGHT.wallKnockbackBounce ?? 0.42;
    const walkKick = CONFIG.ARENA_FIGHT.wallWalkKick ?? 3.4;

    if (fighter.x < minX) {
      fighter.x = minX;
      if ((fighter.vx ?? 0) < -0.02) {
        fighter.vx = -fighter.vx * bounce;
      } else if (moveDx != null && moveDx < 0) {
        fighter.vx = walkKick;
      }
      return;
    }
    if (fighter.x > maxX) {
      fighter.x = maxX;
      if ((fighter.vx ?? 0) > 0.02) {
        fighter.vx = -fighter.vx * bounce;
      } else if (moveDx != null && moveDx > 0) {
        fighter.vx = -walkKick;
      }
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

  _syncFightersToUsers(match, users) {
    for (const fighter of Object.values(match.fighters)) {
      const user = users.get(fighter.userId);
      if (!user) continue;
      user.hp = fighter.hp;
      user.rage = fighter.rage;
      user.rageState = fighter.rageState;
      user.x = fighter.x;
      user.y = fighter.y;
      user.facing = fighter.facing;
      user.actionState = fighter.actionState;
      user.currentSkillId = fighter.currentSkillId;
      user.phase = fighter.phase;
      user.phaseFrame = fighter.phaseFrame || 0;
      user.vx = fighter.vx || 0;
    }
  }

  // ─── Opponent Profiling ───────────────────────────────────────────

  _updateProfiles(match) {
    for (const fighter of Object.values(match.fighters)) {
      const opponent = match.getOpponent(fighter.userId);
      if (!opponent) continue;
      const profileKey = `${match.id}:${fighter.userId}`;
      let profile = this._profiles.get(profileKey);
      if (!profile) {
        profile = new OpponentProfile();
        this._profiles.set(profileKey, profile);
      }
      // Record opponent's current action state as observed behavior
      const oppAction = opponent.currentAction;
      if (oppAction) {
        if (oppAction.phase === 'active' || oppAction.phase === 'startup') {
          profile.recordAction(oppAction.type, oppAction.skill?.id || null);
        } else if (oppAction.phase === 'recovery') {
          profile.recordAction('recovery', null);
        }
      } else {
        // Opponent is idle or moving
        profile.recordAction(opponent.actionState === 'walking' ? 'move' : 'idle', null);
      }
    }
  }

  _adaptStrategies(match) {
    for (const fighter of Object.values(match.fighters)) {
      const opponent = match.getOpponent(fighter.userId);
      if (!opponent) continue;
      const profileKey = `${match.id}:${fighter.userId}`;
      const profile = this._profiles.get(profileKey);
      if (!profile) continue;

      const suggestedStyle = profile.suggestCounterStyle();
      if (suggestedStyle) {
        const currentPlan = this.policyManager.getPlan(fighter.userId);
        // Only override if style is different and we have enough data
        if (currentPlan.style !== suggestedStyle && profile.framesObserved >= 20) {
          this.policyManager.setPlan(fighter.userId, {
            ...currentPlan,
            style: suggestedStyle,
            reason: 'adapted_from_profile',
          });
        }
      }
    }
  }

  _syncUserPosition(user, fighter) {
    user.x = fighter.x;
    user.y = fighter.y;
    user.targetX = fighter.x;
    user.targetY = fighter.y;
  }

  // ─── Geometry ─────────────────────────────────────────────────────

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

  _recordRageReady(match, fighter, events) {
    if (fighter.rage < 100 || fighter._ultimateReadyAnnounced) return;
    fighter._ultimateReadyAnnounced = true;
    events.push(match.recordEvent('ultimate:ready', {
      fighterId: fighter.userId,
      rage: fighter.rage,
    }));
  }

  _spawnProjectile(match, fighter, skill) {
    const pDef = skill.projectile;
    if (!pDef) return;
    match.projectiles.push({
      id: `proj_${match.frame}_${fighter.userId}`,
      ownerId: fighter.userId,
      skillId: skill.id,
      x: fighter.x + (fighter.facing >= 0 ? 22 : -22),
      y: fighter.y + (pDef.yOffset || -44),
      width: pDef.width || 16,
      height: pDef.height || 16,
      speed: pDef.speed || 12,
      facing: fighter.facing || 1,
      lifetime: pDef.lifetimeFrames || 40,
      damage: skill.damage || 0,
      guardDamage: skill.guardDamage || 0,
      hitstunFrames: skill.hitstunFrames || 10,
      blockstunFrames: skill.blockstunFrames || 8,
      knockbackX: skill.knockback?.x || 12,
      hitSpark: skill.hitSpark || 'large',
    });
  }

  _tickProjectiles(match, events) {
    if (!Array.isArray(match.projectiles) || match.projectiles.length === 0) return;

    for (let i = match.projectiles.length - 1; i >= 0; i -= 1) {
      const p = match.projectiles[i];
      p.x += p.speed * p.facing;
      p.lifetime -= 1;
      if (p.lifetime <= 0 || p.x < ARENA_LIMITS.minX - 40 || p.x > ARENA_LIMITS.maxX + 40) {
        match.projectiles.splice(i, 1);
        continue;
      }

      const owner = match.getFighter(p.ownerId);
      const target = owner ? match.getOpponent(owner.userId) : null;
      if (!target) continue;

      const projBox = { x: p.x, y: p.y, width: p.width, height: p.height };
      const hurtbox = this._getWorldHurtbox(target);
      if (!this._rectsOverlap(projBox, hurtbox)) continue;

      const guarded = target.currentAction?.type === 'defend' && target.currentAction?.phase === 'active';
      if (guarded) {
        target.hp = Math.max(0, target.hp - Math.max(0, p.guardDamage));
        target.guardFrames = p.blockstunFrames;
        target.actionState = ACTION_STATES.BLOCKSTUN;
      } else {
        target.hp = Math.max(0, target.hp - Math.max(0, p.damage));
        target.stunFrames = p.hitstunFrames;
        target.actionState = ACTION_STATES.HITSTUN;
        target.vx = p.knockbackX * p.facing;
      }
      events.push(match.recordEvent('projectile:hit', {
        projectileId: p.id,
        ownerId: p.ownerId,
        targetId: target.userId,
        x: Math.round(p.x),
        y: Math.round(p.y),
        hitSpark: p.hitSpark,
      }));
      match.projectiles.splice(i, 1);
    }
  }
}
