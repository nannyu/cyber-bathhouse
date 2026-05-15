/**
 * v2 游戏配置常量
 */

export const GAME_CONFIG = {
    // 游戏循环
    TICK_RATE: 10,                    // Hz (100ms per tick)
    BROADCAST_INTERVAL: 2,           // 每 N ticks 广播一次状态 (5Hz)
    AGENT_TICK_INTERVAL: 20,         // 每 N ticks 推送 Agent 感知 (2s)
    AGENT_TIMEOUT_MS: 1500,          // Agent 响应超时
    MAX_ACTIONS_PER_TICK: 2,         // Agent 每次最多返回动作数

    // 地图
    MAP_WIDTH: 20,
    MAP_HEIGHT: 13,
    TILE_SIZE: 32,

    // 角色
    MOVE_SPEED: 1,                   // tiles per tick
    INTERACT_RANGE: 1,               // 必须相邻才能交互
    ENERGY_MAX: 100,
    ENERGY_REGEN_PER_TICK: 1,
    ENERGY_COST: {
        move: 1,
        interact: 3,
        pickup: 1,
        drop: 1,
        say: 0,
        trade: 2,
        wait: 0,
    },
    ENERGY_WAIT_BONUS: 2,           // wait 额外恢复

    // 锅炉
    BOILER: {
        TEMP_RISE_PER_TICK: 0.15,      // 每 tick 温度上升
        FUEL_CONSUME_PER_TICK: 0.05,   // 每 tick 燃料消耗
        REPAIR_TEMP_REDUCTION: 30,     // 修理降温量
        OVERHEAT_THRESHOLD: 95,        // 过热阈值
        EXPLOSION_THRESHOLD: 100,      // 爆炸阈值
        INITIAL_TEMP: 60,
        INITIAL_FUEL: 80,
        INITIAL_CONDITION: 100,
    },

    // 视野
    VISIBILITY_RANGE: 5,             // tiles

    // CBAP 签名
    CBAP_SECRET: process.env.CBAP_SECRET || 'cyberbath-dev-secret',
};
