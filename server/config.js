/**
 * 赛博澡堂 — 服务端配置
 */

export const CONFIG = {
  // 服务器
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // 世界参数
  WORLD_WIDTH: 800,
  WORLD_HEIGHT: 500,

  // 池子范围
  POOL: {
    x: 150,
    y: 200,
    width: 500,
    height: 200,
  },

  // Tick 频率 (Hz)
  TICK_RATE: parseInt(process.env.TICK_RATE || '20', 10),

  // 用户限制
  MAX_USERS: parseInt(process.env.MAX_USERS || '50', 10),
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 20,

  // 消息
  MESSAGE_MAX_LENGTH: 500,
  MESSAGE_HISTORY_SIZE: 200,

  // 气泡
  BUBBLE_DURATION: 3000, // 3 秒

  // Token
  TOKEN_EXPIRY: parseInt(process.env.TOKEN_EXPIRY || '86400000', 10), // 24 小时

  // 速率限制
  RATE_LIMIT_PER_SECOND: 5,

  // 角色移动速度 (像素/秒)
  MOVE_SPEED: 120,

  // 战斗
  FIGHT: {
    MIN_DAMAGE: 5,
    MAX_DAMAGE: 15,
    ATTACK_COOLDOWN: 1000, // 1 秒攻击冷却
    MAX_HP: 100,
  },

  // 宠物
  PET_FOLLOW_DISTANCE: 30,
  PET_FOLLOW_SPEED: 100,

  // 角色配色方案
  CHARACTER_PALETTES: [
    { hair: '#ff2d78', skin: '#ffcba4', shorts: '#00f0ff' },
    { hair: '#b829dd', skin: '#f4c28d', shorts: '#39ff14' },
    { hair: '#00f0ff', skin: '#d4a373', shorts: '#ff6e27' },
    { hair: '#39ff14', skin: '#ffcba4', shorts: '#ff2d78' },
    { hair: '#ff6e27', skin: '#f4c28d', shorts: '#b829dd' },
  ],

  // 宠物类型
  PET_TYPES: ['cyber_cat', 'mech_dog', 'e_octopus', 'glow_fox', 'mini_dragon'],

  // 出生点范围（池子外）
  SPAWN_AREAS: [
    { x: 50, y: 80, width: 200, height: 100 },   // 左上
    { x: 550, y: 80, width: 200, height: 100 },   // 右上
    { x: 50, y: 420, width: 200, height: 60 },    // 左下
    { x: 550, y: 420, width: 200, height: 60 },   // 右下
  ],

  // MCP agent 离线保留时间 (ms)
  AGENT_OFFLINE_TIMEOUT: 300000, // 5 分钟
};
