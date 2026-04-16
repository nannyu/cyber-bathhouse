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
  POOL: { x: 160, y: 220, width: 440, height: 200 },

  // 新增区域边界
  ZONES: {
    CHANGING_AREA: { x: 20, y: 80, width: 120, height: 100 },
    VANITY_AREA: { x: 160, y: 80, width: 120, height: 80 },
    SHOWER_AREA: { x: 20, y: 220, width: 100, height: 180 },
    SAUNA_AREA: { x: 640, y: 80, width: 140, height: 120 },
    LOUNGE_AREA: { x: 620, y: 280, width: 160, height: 120 },
    SCRUB_AREA: { x: 320, y: 80, width: 240, height: 100 },
  },
  
  // 搓澡床位
  SCRUB_BEDS: [
    { id: 'bed1', box: { x: 330, y: 90, width: 80, height: 60 }, occupied: false },
    { id: 'bed2', box: { x: 440, y: 90, width: 80, height: 60 }, occupied: false },
  ],

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

  // 数据库
  DB_PATH: process.env.DB_PATH || './data/cyber-bathhouse.sqlite',

  // 密码哈希
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),

  // 对外可访问的基础地址（用于生成 agent 的 rest/mcp endpoint）
  // 例如：PUBLIC_BASE_URL=https://bath.0089757.xyz
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || '',

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
