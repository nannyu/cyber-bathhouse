/**
 * v2 动作类型定义与校验
 */

/** 动作类型枚举 */
export const ACTION_TYPES = {
    MOVE_TO: 'move_to',
    INTERACT: 'interact',
    PICKUP: 'pickup',
    DROP: 'drop',
    SAY: 'say',
    WAIT: 'wait',
};

/** 交互意图枚举 */
export const INTERACT_INTENTS = {
    REPAIR: 'repair',
    FUEL: 'fuel',
    SERVE: 'serve',
    RESTOCK: 'restock',
    COLLECT: 'collect',
    CLEAN: 'clean',
};

/** 设施类型枚举 */
export const FACILITY_TYPES = {
    BOILER: 'boiler',
    BATH: 'bath',
    COUNTER: 'counter',
    SHELF_SOAP: 'shelf_soap',
    SHELF_TOWEL: 'shelf_towel',
    TOOLBOX: 'toolbox',
    CONTROL_PANEL: 'control_panel',
};

/** 角色状态枚举 */
export const CHARACTER_STATES = {
    IDLE: 'idle',
    MOVING: 'moving',
    INTERACTING: 'interacting',
};

/** 设施状态枚举 */
export const FACILITY_STATUS = {
    NORMAL: 'normal',
    OVERHEATING: 'overheating',
    BROKEN: 'broken',
};

/** 任务状态枚举 */
export const TASK_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
};

/**
 * 校验动作格式是否合法
 * @param {Object} action
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateActionSchema(action) {
    if (!action || typeof action !== 'object') {
        return { valid: false, error: 'Action must be an object' };
    }

    switch (action.type) {
        case ACTION_TYPES.MOVE_TO:
            if (typeof action.x !== 'number' || typeof action.y !== 'number') {
                return { valid: false, error: 'move_to requires numeric x and y' };
            }
            if (!Number.isInteger(action.x) || !Number.isInteger(action.y)) {
                return { valid: false, error: 'move_to x and y must be integers' };
            }
            return { valid: true };

        case ACTION_TYPES.INTERACT:
            if (typeof action.targetId !== 'string' || !action.targetId) {
                return { valid: false, error: 'interact requires targetId string' };
            }
            if (typeof action.intent !== 'string' || !action.intent) {
                return { valid: false, error: 'interact requires intent string' };
            }
            return { valid: true };

        case ACTION_TYPES.SAY:
            if (typeof action.text !== 'string' || !action.text) {
                return { valid: false, error: 'say requires text string' };
            }
            return { valid: true };

        case ACTION_TYPES.WAIT:
            return { valid: true };

        default:
            return { valid: false, error: `Unknown action type: ${action.type}` };
    }
}
