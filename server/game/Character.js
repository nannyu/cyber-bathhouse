/**
 * 角色实体 — 玩家或 Agent 在游戏中的代表
 */

import { GAME_CONFIG } from './config-v2.js';
import { CHARACTER_STATES } from '../../shared/actions-v2.js';

export class Character {
    /**
     * @param {Object} options
     * @param {string} options.id
     * @param {string} options.type - 'player' | 'agent'
     * @param {string} options.name
     * @param {number} options.x - 初始网格 X
     * @param {number} options.y - 初始网格 Y
     * @param {string} [options.endpoint] - Agent webhook URL
     * @param {string} [options.apiKey] - Agent API key
     */
    constructor({ id, type, name, x, y, endpoint, apiKey }) {
        this.id = id;
        this.type = type; // 'player' | 'agent'
        this.name = name;
        this.x = x;
        this.y = y;
        this.energy = GAME_CONFIG.ENERGY_MAX;
        this.path = [];           // 剩余路径 [{x,y}, ...]
        this.actionQueue = [];    // 排队的动作
        this.state = CHARACTER_STATES.IDLE;

        // Agent 专属
        this.endpoint = endpoint || null;
        this.apiKey = apiKey || null;
    }

    /**
     * 设置移动路径
     * @param {Array<{x: number, y: number}>} path
     */
    setPath(path) {
        this.path = path || [];
        if (this.path.length > 0) {
            this.state = CHARACTER_STATES.MOVING;
        }
    }

    /**
     * 沿路径前进一步（每 tick 调用）
     * @returns {boolean} 是否移动了
     */
    advance() {
        if (this.path.length === 0) {
            if (this.state === CHARACTER_STATES.MOVING) {
                this.state = CHARACTER_STATES.IDLE;
            }
            return false;
        }

        const next = this.path.shift();
        this.x = next.x;
        this.y = next.y;

        // 消耗能量
        this.energy = Math.max(0, this.energy - GAME_CONFIG.ENERGY_COST.move);

        if (this.path.length === 0) {
            this.state = CHARACTER_STATES.IDLE;
        }

        return true;
    }

    /**
     * 排队一个动作
     * @param {Object} action
     */
    queueAction(action) {
        this.actionQueue.push(action);
    }

    /**
     * 取出下一个排队动作
     * @returns {Object|null}
     */
    dequeueAction() {
        return this.actionQueue.shift() || null;
    }

    /**
     * 每 tick 能量自然恢复
     */
    regenEnergy() {
        this.energy = Math.min(GAME_CONFIG.ENERGY_MAX, this.energy + GAME_CONFIG.ENERGY_REGEN_PER_TICK);
    }

    /**
     * 消耗能量
     * @param {number} amount
     * @returns {boolean} 是否有足够能量
     */
    consumeEnergy(amount) {
        if (this.energy < amount) return false;
        this.energy -= amount;
        return true;
    }

    /**
     * 检查是否有足够能量执行动作
     * @param {string} actionType
     * @returns {boolean}
     */
    hasEnergy(actionType) {
        const cost = GAME_CONFIG.ENERGY_COST[actionType] || 0;
        return this.energy >= cost;
    }

    /**
     * 序列化
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            x: this.x,
            y: this.y,
            energy: Math.round(this.energy),
            state: this.state,
            pathLength: this.path.length,
        };
    }
}
