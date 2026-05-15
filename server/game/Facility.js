/**
 * 设施实体 — 锅炉等可交互设施
 */

import { GAME_CONFIG } from './config-v2.js';
import { FACILITY_STATUS } from '../../shared/actions-v2.js';

export class Facility {
    /**
     * @param {Object} options
     * @param {string} options.id
     * @param {string} options.type - 'boiler' | 'control_panel' | 'toolbox' | ...
     * @param {number} options.x - 网格 X
     * @param {number} options.y - 网格 Y
     */
    constructor({ id, type, x, y }) {
        this.id = id;
        this.type = type;
        this.x = x;
        this.y = y;

        // 锅炉专属状态
        if (type === 'boiler') {
            const cfg = GAME_CONFIG.BOILER;
            this.state = {
                temperature: cfg.INITIAL_TEMP,
                fuel: cfg.INITIAL_FUEL,
                condition: cfg.INITIAL_CONDITION,
                status: FACILITY_STATUS.NORMAL,
            };
        } else {
            this.state = { status: FACILITY_STATUS.NORMAL };
        }
    }

    /**
     * 每 tick 更新设施状态（仅锅炉有动态状态）
     */
    tick() {
        if (this.type !== 'boiler') return;

        const cfg = GAME_CONFIG.BOILER;

        // 有燃料时温度上升、燃料消耗
        if (this.state.fuel > 0) {
            this.state.temperature += cfg.TEMP_RISE_PER_TICK;
            this.state.fuel = Math.max(0, this.state.fuel - cfg.FUEL_CONSUME_PER_TICK);
        }

        // 检查过热
        if (this.state.temperature >= cfg.EXPLOSION_THRESHOLD) {
            this.state.status = FACILITY_STATUS.BROKEN;
        } else if (this.state.temperature >= cfg.OVERHEAT_THRESHOLD) {
            this.state.status = FACILITY_STATUS.OVERHEATING;
        }
    }

    /**
     * 修理锅炉 — 降低温度
     * @returns {boolean} 是否成功修理
     */
    repair() {
        if (this.type !== 'boiler') return false;
        if (this.state.status === FACILITY_STATUS.BROKEN) return false;

        const cfg = GAME_CONFIG.BOILER;
        this.state.temperature = Math.max(0, this.state.temperature - cfg.REPAIR_TEMP_REDUCTION);

        // 修理后检查是否恢复正常
        if (this.state.temperature < cfg.OVERHEAT_THRESHOLD) {
            this.state.status = FACILITY_STATUS.NORMAL;
        }

        return true;
    }

    /**
     * 添加燃料
     * @param {number} amount
     */
    addFuel(amount) {
        if (this.type !== 'boiler') return;
        this.state.fuel = Math.min(100, this.state.fuel + amount);
    }

    /**
     * 是否正在过热
     */
    isOverheating() {
        return this.state.status === FACILITY_STATUS.OVERHEATING;
    }

    /**
     * 序列化
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            x: this.x,
            y: this.y,
            state: { ...this.state },
        };
    }
}
