/**
 * Stores high-level AI combat plans. LLM calls can update these plans, but
 * combat simulation never waits on them.
 */

export const DEFAULT_COMBAT_PLAN = {
  style: 'footsies',
  preferredRange: 'mid',
  risk: 0.4,
  meterPolicy: 'save_for_kill',
  ultimatePolicy: 'confirm_only',
  currentGoal: 'control_space',
  expiresAt: 0,
  rules: [],
};

export class AgentPolicyManager {
  constructor() {
    this._plans = new Map();
    this._queuedIntents = new Map();
  }

  setPlan(userId, plan = {}) {
    const cleanPlan = Object.fromEntries(
      Object.entries(plan).filter(([, value]) => value !== undefined),
    );
    const merged = {
      ...DEFAULT_COMBAT_PLAN,
      ...cleanPlan,
      expiresAt: cleanPlan.expiresAt || Date.now() + 5000,
      updatedAt: Date.now(),
    };
    this._plans.set(userId, merged);
    return merged;
  }

  getPlan(userId) {
    const plan = this._plans.get(userId);
    if (!plan) {
      return DEFAULT_COMBAT_PLAN;
    }
    if (plan.expiresAt && Date.now() > plan.expiresAt) {
      return {
        ...DEFAULT_COMBAT_PLAN,
        style: plan.style || DEFAULT_COMBAT_PLAN.style,
        risk: plan.risk ?? DEFAULT_COMBAT_PLAN.risk,
      };
    }
    return plan;
  }

  clearPlan(userId) {
    this._plans.delete(userId);
  }

  queueIntent(userId, intent = {}) {
    const cleanIntent = Object.fromEntries(
      Object.entries(intent).filter(([, value]) => value !== undefined),
    );
    this._queuedIntents.set(userId, {
      ...cleanIntent,
      queuedAt: Date.now(),
      expiresAt: Date.now() + 1500,
    });
  }

  consumeIntent(userId) {
    const intent = this._queuedIntents.get(userId);
    if (!intent) return null;
    this._queuedIntents.delete(userId);
    if (intent.expiresAt && Date.now() > intent.expiresAt) {
      return null;
    }
    return intent;
  }
}
