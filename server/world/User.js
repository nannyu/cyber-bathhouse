/**
 * 用户实体
 */

import { CONFIG } from '../config.js';
import { Pet } from './Pet.js';

/** 角色状态 */
const STATES = {
  IDLE: 'idle',
  WALKING: 'walking',
  SOAKING: 'soaking',
  TALKING: 'talking',
  FIGHTING: 'fighting',
  SAUNA: 'sauna',
  SCRUBBING: 'scrubbing',
};

export class User {
  /**
   * @param {Object} options
   * @param {string} options.id - 用户 ID
   * @param {string} options.name - 昵称
   * @param {string} options.type - 用户类型 (browser | agent)
   * @param {string} [options.petType] - 宠物类型
   */
  constructor({ id, name, type, petType }) {
    this.id = id;
    this.name = name;
    this.type = type; // 'browser' | 'agent'
    this.state = STATES.IDLE;

    /** NPC（id 以 npc_ 开头）不携带宠物，仅真实玩家有宠物 */
    const isNpc = typeof id === 'string' && id.startsWith('npc_');

    // 随机出生位置
    const spawn = CONFIG.SPAWN_AREAS[Math.floor(Math.random() * CONFIG.SPAWN_AREAS.length)];
    this.x = spawn.x + Math.random() * spawn.width;
    this.y = spawn.y + Math.random() * spawn.height;

    // 移动目标
    this.targetX = this.x;
    this.targetY = this.y;

    // HP
    this.hp = CONFIG.FIGHT.MAX_HP;

    // 角色配色（随机分配）
    this.palette = CONFIG.CHARACTER_PALETTES[
      Math.floor(Math.random() * CONFIG.CHARACTER_PALETTES.length)
    ];

    // AI 宠物（仅非 NPC）
    if (isNpc) {
      this.pet = null;
    } else {
      const resolvedPetType = petType && CONFIG.PET_TYPES.includes(petType)
        ? petType
        : CONFIG.PET_TYPES[0];
      this.pet = new Pet(resolvedPetType, this.x, this.y);
    }

    // 气泡
    this._bubbleText = null;
    this._bubbleTimer = 0;

    // 时间戳
    this.joinedAt = Date.now();
    this.lastActive = Date.now();

    // 回血计时器
    this._healTimer = 0;

    // 战斗引用
    this.fightId = null;
  }

  /**
   * 每帧更新
   * @param {number} dt - 帧间隔（毫秒）
   */
  update(dt) {
    this.lastActive = Date.now();

    // 移动
    if (this.state === STATES.WALKING) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 2) {
        // 到达
        this.x = this.targetX;
        this.y = this.targetY;
        this._checkZoneState();
      } else {
        const speed = CONFIG.MOVE_SPEED * (dt / 1000);
        const ratio = Math.min(speed / dist, 1);
        this.x += dx * ratio;
        this.y += dy * ratio;
      }
    }

    // 区域恢复生命值逻辑
    if (this.state === STATES.SAUNA || this.state === STATES.SCRUBBING || this.state === STATES.SOAKING) {
      this._healTimer += dt;
      if (this._healTimer >= 1000) { // 每秒回血
        this._healTimer = 0;
        if (this.hp < CONFIG.FIGHT.MAX_HP) {
          let healAmount = this.state === STATES.SCRUBBING ? 5 : (this.state === STATES.SAUNA ? 3 : 1);
          this.hp = Math.min(CONFIG.FIGHT.MAX_HP, this.hp + healAmount);
        }
      }
    }

    // 气泡淡出
    if (this._bubbleTimer > 0) {
      this._bubbleTimer -= dt;
      if (this._bubbleTimer <= 0) {
        this._bubbleText = null;
        // 恢复到合适的状态
        if (this.state === STATES.TALKING) {
          this._checkZoneState();
        }
      }
    }

    if (this.pet) {
      this.pet.update(dt, this.x, this.y);
    }
  }

  /**
   * 设置移动目标
   * @param {number} x
   * @param {number} y
   */
  moveTo(x, y) {
    if (this.state === STATES.FIGHTING) return;

    this.targetX = Math.max(0, Math.min(CONFIG.WORLD_WIDTH, x));
    this.targetY = Math.max(0, Math.min(CONFIG.WORLD_HEIGHT, y));
    this.state = STATES.WALKING;
  }

  /**
   * 显示聊天气泡
   * @param {string} text
   */
  showBubble(text) {
    this._bubbleText = text;
    this._bubbleTimer = CONFIG.BUBBLE_DURATION;
    if (this.state !== STATES.FIGHTING) {
      this.state = STATES.TALKING;
    }
  }

  /**
   * 进入池子
   */
  enterPool() {
    if (this.state === STATES.FIGHTING) return;

    // 移动到池子范围内
    const pool = CONFIG.POOL;
    this.x = pool.x + 50 + Math.random() * (pool.width - 100);
    this.y = pool.y + 30 + Math.random() * (pool.height - 60);
    this.targetX = this.x;
    this.targetY = this.y;
    this.state = STATES.SOAKING;
  }

  /**
   * 离开池子
   */
  leavePool() {
    if (this.state === STATES.FIGHTING) return;

    // 移到池子外面
    const spawn = CONFIG.SPAWN_AREAS[Math.floor(Math.random() * CONFIG.SPAWN_AREAS.length)];
    this.x = spawn.x + Math.random() * spawn.width;
    this.y = spawn.y + Math.random() * spawn.height;
    this.targetX = this.x;
    this.targetY = this.y;
    this.state = STATES.IDLE;
  }

  /**
   * 检查所处区域自动切换状态
   */
  _checkZoneState() {
    if (this.state === STATES.FIGHTING) return;

    // 桑拿区
    const sauna = CONFIG.ZONES.SAUNA_AREA;
    if (sauna && this.x >= sauna.x && this.x <= sauna.x + sauna.width &&
        this.y >= sauna.y && this.y <= sauna.y + sauna.height) {
      this.state = STATES.SAUNA;
      return;
    }

    // 搓澡床
    for (const bed of CONFIG.SCRUB_BEDS) {
      const b = bed.box;
      if (this.x >= b.x && this.x <= b.x + b.width &&
          this.y >= b.y && this.y <= b.y + b.height) {
        this.state = STATES.SCRUBBING;
        return;
      }
    }

    const pool = CONFIG.POOL;
    const inPool = this.x >= pool.x && this.x <= pool.x + pool.width &&
                   this.y >= pool.y && this.y <= pool.y + pool.height;

    if (inPool) {
      this.state = STATES.SOAKING;
    } else {
      this.state = STATES.IDLE;
    }
  }

  /**
   * 序列化为 JSON（发送给客户端）
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      x: Math.round(this.x),
      y: Math.round(this.y),
      targetX: Math.round(this.targetX),
      targetY: Math.round(this.targetY),
      state: this.state,
      hp: this.hp,
      palette: this.palette,
      pet: this.pet ? this.pet.toJSON() : null,
      bubble: this._bubbleText,
      bubbleTimer: this._bubbleTimer,
      fightId: this.fightId,
    };
  }

  /**
   * 序列化为简要信息
   */
  toSummary() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      state: this.state,
      hp: this.hp,
    };
  }
}
