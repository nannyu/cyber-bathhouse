/**
 * 动作校验器 — 统一校验玩家和 Agent 的动作合法性
 */

import { GAME_CONFIG } from './config-v2.js';
import { ACTION_TYPES, validateActionSchema } from '../../shared/actions-v2.js';
import { findPath } from './Pathfinder.js';

export class ActionValidator {
    /**
     * 校验一组动作
     * @param {Array<Object>} actions - 待校验动作列表
     * @param {import('./Character.js').Character} character - 执行者
     * @param {import('./Room.js').Room} room - 房间上下文
     * @returns {{ validated: Array<Object>, rejected: Array<{action: Object, reason: string}> }}
     */
    validateAll(actions, character, room) {
        const validated = [];
        const rejected = [];

        if (!Array.isArray(actions)) {
            return { validated, rejected: [{ action: null, reason: 'Actions must be an array' }] };
        }

        // 限制最大动作数
        const limited = actions.slice(0, GAME_CONFIG.MAX_ACTIONS_PER_TICK);

        for (const action of limited) {
            const result = this.validate(action, character, room);
            if (result.valid) {
                validated.push(action);
            } else {
                rejected.push({ action, reason: result.reason });
            }
        }

        return { validated, rejected };
    }

    /**
     * 校验单个动作
     * @param {Object} action
     * @param {import('./Character.js').Character} character
     * @param {import('./Room.js').Room} room
     * @returns {{ valid: boolean, reason?: string, path?: Array }}
     */
    validate(action, character, room) {
        // 1. Schema 格式校验
        const schema = validateActionSchema(action);
        if (!schema.valid) {
            return { valid: false, reason: schema.error };
        }

        // 2. 能量检查
        const energyCost = GAME_CONFIG.ENERGY_COST[action.type] || 0;
        if (character.energy < energyCost) {
            return { valid: false, reason: `Insufficient energy: need ${energyCost}, have ${Math.round(character.energy)}` };
        }

        // 3. 按类型校验
        switch (action.type) {
            case ACTION_TYPES.MOVE_TO:
                return this._validateMoveTo(action, character, room);
            case ACTION_TYPES.INTERACT:
                return this._validateInteract(action, character, room);
            case ACTION_TYPES.WAIT:
                return { valid: true };
            case ACTION_TYPES.SAY:
                return { valid: true };
            default:
                return { valid: false, reason: `Unsupported action type: ${action.type}` };
        }
    }

    /**
     * 校验 move_to 动作
     */
    _validateMoveTo(action, character, room) {
        const { x, y } = action;
        const map = room.map;

        // 边界检查
        if (x < 0 || x >= map.width || y < 0 || y >= map.height) {
            return { valid: false, reason: `Target (${x},${y}) out of map bounds` };
        }

        // 目标可通行检查
        if (!map.isWalkable(x, y)) {
            return { valid: false, reason: `Target (${x},${y}) is not walkable` };
        }

        // 已在目标位置
        if (character.x === x && character.y === y) {
            return { valid: true, path: [] };
        }

        // 寻路检查
        const path = findPath(map, character.x, character.y, x, y);
        if (!path) {
            return { valid: false, reason: `No path from (${character.x},${character.y}) to (${x},${y})` };
        }

        return { valid: true, path };
    }

    /**
     * 校验 interact 动作
     */
    _validateInteract(action, character, room) {
        const { targetId, intent } = action;

        // 查找目标设施
        const facility = room.getFacility(targetId);
        if (!facility) {
            return { valid: false, reason: `Target facility '${targetId}' not found` };
        }

        // 相邻检查
        if (!room.map.isAdjacent(character.x, character.y, facility.x, facility.y)) {
            return { valid: false, reason: `Not adjacent to '${targetId}' at (${facility.x},${facility.y}). Character at (${character.x},${character.y})` };
        }

        // 意图与设施类型匹配检查
        const validIntents = this._getValidIntents(facility.type);
        if (!validIntents.includes(intent)) {
            return { valid: false, reason: `Intent '${intent}' not valid for facility type '${facility.type}'. Valid: ${validIntents.join(', ')}` };
        }

        return { valid: true };
    }

    /**
     * 获取设施类型支持的交互意图
     */
    _getValidIntents(facilityType) {
        switch (facilityType) {
            case 'boiler': return ['repair', 'fuel'];
            case 'control_panel': return ['repair'];
            case 'toolbox': return ['pickup'];
            case 'counter': return ['collect', 'serve'];
            case 'shelf_soap': return ['pickup', 'restock'];
            case 'shelf_towel': return ['pickup', 'restock'];
            case 'bath': return ['serve', 'clean'];
            default: return [];
        }
    }
}
