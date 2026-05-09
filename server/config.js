/**
 * 赛博澡堂 — 服务端配置
 */

/** map_bg.jpg 中擂台可战斗矩形（世界坐标，背景尺寸 1024x768） */
const ARENA_FIGHT_RECT = { x: 393, y: 526, width: 275, height: 162 };
const ARENA_FIGHT_CORNERS = {
  topLeft: { x: 393, y: 526 },
  topRight: { x: 668, y: 526 },
  bottomRight: { x: 668, y: 688 },
  bottomLeft: { x: 393, y: 688 },
};

/** 底部擂台矩形 — ZONES.ARENA 与 ARENA_FIGHT 同源 */
const ARENA_ZONE_RECT = { ...ARENA_FIGHT_RECT };

export const CONFIG = {
  // 服务器
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // 世界参数
  WORLD_WIDTH: 1024,
  WORLD_HEIGHT: 768,

  // 池子范围 (中央泳池)
  POOL: { x: 300, y: 250, width: 450, height: 300 },

  // 新增区域边界
  ZONES: {
    CHANGING_AREA: { x: 800, y: 50, width: 200, height: 150 },
    VANITY_AREA: { x: 800, y: 50, width: 200, height: 150 }, // 可以合并在更衣区，或不需要判定
    SHOWER_AREA: { x: 50, y: 50, width: 200, height: 150 },
    SAUNA_AREA: { x: 300, y: 50, width: 200, height: 150 },
    LOUNGE_AREA: { x: 50, y: 250, width: 200, height: 150 },
    SCRUB_AREA: { x: 550, y: 50, width: 200, height: 150 },
    SMALL_POOL: { x: 800, y: 250, width: 150, height: 150 },
    /** 底部擂台逻辑区（地走、排队与此对齐） */
    ARENA: { ...ARENA_ZONE_RECT },
  },

  // 搓澡床位
  SCRUB_BEDS: [
    { id: 'bed1', box: { x: 560, y: 60, width: 80, height: 60 }, occupied: false },
    { id: 'bed2', box: { x: 650, y: 60, width: 80, height: 60 }, occupied: false },
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

  /** 克隆 URL，写入「给 AI 的 onboarding 提示词」； fork 部署时请改成你的仓库 */
  PROJECT_REPO_URL: process.env.PROJECT_REPO_URL || '',

  // 速率限制
  RATE_LIMIT_PER_SECOND: 5,

  // 角色移动速度 (像素/秒)
  MOVE_SPEED: 120,

  // 搓澡
  SCRUB: {
    HEAL_PER_TICK: 10,        // 每次回血量（很快）
    TICK_INTERVAL: 500,       // 每 0.5 秒回一次血
    PROXIMITY_RANGE: 120,      // 靠近王师傅多少像素可触发搓澡
    DURATION: 15000,           // 搓澡持续 15 秒
  },

  // 战斗
  FIGHT: {
    MIN_DAMAGE: 5,
    MAX_DAMAGE: 15,
    ATTACK_COOLDOWN: 1000, // 1 秒攻击冷却
    MAX_HP: 100,
  },

  // 格斗场：所有边界从背景图中量出的可战斗矩形推导，避免和视觉擂台错位
  ARENA_FIGHT: (() => {
    const az = ARENA_FIGHT_RECT;
    const tickRate = parseInt(process.env.TICK_RATE || '20', 10);
    const roundSec = parseInt(process.env.FIGHT_ROUND_SECONDS || '60', 10);
    const minX = az.x;
    const maxX = az.x + az.width;
    const minY = az.y;
    const maxY = az.y + az.height;
    const rowY = Math.round(az.y + az.height / 2);
    const cx = Math.round(az.x + az.width / 2);
    return {
      bounds: { ...az },
      corners: { ...ARENA_FIGHT_CORNERS },
      centerX: cx,
      centerY: rowY,
      leftSpawn: { x: cx - 80, y: rowY },
      rightSpawn: { x: cx + 80, y: rowY },
      combatLimits: { minX, maxX, minY, maxY, y: rowY },
      leftBench: [
        { x: 120, y: rowY - 38 },
        { x: 120, y: rowY },
        { x: 120, y: rowY + 38 },
      ],
      rightBench: [
        { x: 880, y: rowY - 38 },
        { x: 880, y: rowY },
        { x: 880, y: rowY + 38 },
      ],
      walkSpeed: 220,
      walkArrivedDist: 6,
      countdownMs: 3000,
      fightStartFlashMs: 800,
      postFightWaitMs: 1500,
      /** 单场对战时长（秒，仅统计 phase=active 的格斗帧） */
      roundDurationSec: roundSec,
      roundDurationFrames: Math.max(1, roundSec * tickRate),
      /** 被击退撞墙：水平速度反向并乘以此系数（轻微反弹） */
      wallKnockbackBounce: 0.42,
      /** 走位主动顶墙时给予的反向初速度（像素/帧量级，由衰减吃掉） */
      wallWalkKick: 3.4,
    };
  })(),

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
  PET_TYPES: ['cyber_cat', 'mech_dog', 'e_octopus', 'glow_fox', 'mini_dragon', 'rainbow_pony', 'cyber_pig'],
  AVAILABLE_SPRITES: ['cyber_brawler', 'neon_punk'],

  // 出生点范围（池子外）
  SPAWN_AREAS: [
    { x: 50, y: 450, width: 200, height: 100 },   // 左侧通道
    { x: 800, y: 450, width: 200, height: 100 },  // 右侧通道
  ],

  // MCP agent 离线保留时间 (ms)
  AGENT_OFFLINE_TIMEOUT: 300000, // 5 分钟
};
