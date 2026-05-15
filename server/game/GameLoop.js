/**
 * 游戏主循环 — 10Hz 固定频率 Tick
 */

import { GAME_CONFIG } from './config-v2.js';
import { ActionValidator } from './ActionValidator.js';
import { ACTION_TYPES, CHARACTER_STATES } from '../../shared/actions-v2.js';

export class GameLoop {
    /**
     * @param {import('./Room.js').Room} room
     * @param {Object} [options]
     * @param {Function} [options.onBroadcast] - 状态广播回调 (state) => void
     * @param {Function} [options.onAgentTick] - Agent Tick 回调 (agentCharacter, perception) => void
     * @param {Function} [options.onActionLog] - 动作日志回调 (logEntry) => void
     */
    constructor(room, options = {}) {
        this.room = room;
        this.validator = new ActionValidator();
        this.onBroadcast = options.onBroadcast || null;
        this.onAgentTick = options.onAgentTick || null;
        this.onActionLog = options.onActionLog || null;
        this._interval = null;
        this._running = false;
    }

    /**
     * 启动游戏循环
     */
    start() {
        if (this._running) return;
        this._running = true;
        const intervalMs = 1000 / GAME_CONFIG.TICK_RATE;
        this._interval = setInterval(() => this._tick(), intervalMs);
    }

    /**
     * 停止游戏循环
     */
    stop() {
        this._running = false;
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
    }

    /**
     * 手动执行一次 tick（用于测试）
     */
    manualTick() {
        this._tick();
    }

    /**
     * 提交动作（来自玩家或 Agent）
     * @param {string} characterId
     * @param {Array<Object>} actions
     * @param {string} [reason] - Agent 的决策原因
     * @returns {{ validated: Array, rejected: Array }}
     */
    submitActions(characterId, actions, reason) {
        const character = this.room.getCharacter(characterId);
        if (!character) {
            return { validated: [], rejected: [{ action: null, reason: 'Character not found' }] };
        }

        const result = this.validator.validateAll(actions, character, this.room);

        // 将合法动作排队
        for (const action of result.validated) {
            character.queueAction(action);
        }

        // 记录日志
        if (this.onActionLog) {
            this.onActionLog({
                tick: this.room.tick,
                actorId: characterId,
                actorType: character.type,
                actionsSubmitted: actions,
                actionsValidated: result.validated,
                actionsRejected: result.rejected,
                reason: reason || null,
            });
        }

        return result;
    }

    /**
     * 核心 Tick 逻辑
     */
    _tick() {
        const room = this.room;
        const startTime = Date.now();

        // 1. 处理排队动作
        this._processActions();

        // 2. 推进角色移动
        room.advanceMovement();

        // 3. 更新设施状态
        room.updateFacilities();

        // 4. 能量恢复
        room.regenAllEnergy();

        // 5. 检查任务
        room.checkTasks();

        // 6. 递增 tick
        room.tick++;

        // 7. 状态广播 (每 N ticks)
        if (room.tick % GAME_CONFIG.BROADCAST_INTERVAL === 0) {
            if (this.onBroadcast) {
                this.onBroadcast(room.getState());
            }
        }

        // 8. Agent Tick (每 N ticks)
        if (room.tick % GAME_CONFIG.AGENT_TICK_INTERVAL === 0) {
            this._agentTick();
        }

        // 9. 性能警告
        const elapsed = Date.now() - startTime;
        if (elapsed > 1000 / GAME_CONFIG.TICK_RATE) {
            console.warn(`[GameLoop] Tick ${room.tick} took ${elapsed}ms (exceeds ${1000 / GAME_CONFIG.TICK_RATE}ms budget)`);
        }
    }

    /**
     * 处理所有角色的排队动作
     */
    _processActions() {
        for (const character of this.room.characters.values()) {
            const action = character.dequeueAction();
            if (!action) continue;

            this._executeAction(character, action);
        }
    }

    /**
     * 执行单个动作
     */
    _executeAction(character, action) {
        switch (action.type) {
            case ACTION_TYPES.MOVE_TO: {
                // 如果角色已在移动中，新路径覆盖旧路径
                const path = this.validator._validateMoveTo(action, character, this.room);
                if (path.valid && path.path) {
                    character.setPath(path.path);
                }
                break;
            }
            case ACTION_TYPES.INTERACT: {
                const facility = this.room.getFacility(action.targetId);
                if (!facility) break;

                // 消耗能量
                if (!character.consumeEnergy(GAME_CONFIG.ENERGY_COST.interact)) break;

                character.state = CHARACTER_STATES.INTERACTING;

                // 执行交互效果
                if (action.intent === 'repair') {
                    facility.repair();
                } else if (action.intent === 'fuel') {
                    facility.addFuel(20);
                }

                // 交互完成后恢复 idle
                character.state = CHARACTER_STATES.IDLE;
                break;
            }
            case ACTION_TYPES.WAIT: {
                // 额外恢复能量
                character.energy = Math.min(
                    GAME_CONFIG.ENERGY_MAX,
                    character.energy + GAME_CONFIG.ENERGY_WAIT_BONUS
                );
                break;
            }
            default:
                break;
        }
    }

    /**
     * 向所有 Agent 推送感知状态
     */
    _agentTick() {
        for (const character of this.room.characters.values()) {
            if (character.type !== 'agent') continue;
            if (!character.endpoint) continue;

            const perception = this.room.getPerception(character.id);
            if (this.onAgentTick) {
                this.onAgentTick(character, perception);
            }
        }
    }
}
