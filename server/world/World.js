/**
 * 世界状态管理器 — 赛博澡堂核心
 */

import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from '../config.js';
import { User } from './User.js';
import { ChatManager } from './ChatManager.js';
import { FightManager } from './FightManager.js';

export class World {
  constructor(database) {
    this.database = database;

    /** @type {Map<string, User>} userId → User */
    this.users = new Map();

    /** @type {ChatManager} */
    this.chatManager = new ChatManager(database);

    /** @type {FightManager} */
    this.fightManager = new FightManager();

    /** @type {Function|null} 广播回调 */
    this._broadcastFn = null;

    /** @type {Function|null} 事件回调 */
    this._eventFn = null;

    /** @type {Map<string, number>} 胜场记录 */
    this.leaderboard = new Map(
      this.database.getLeaderboard().map((entry) => [entry.name, entry.wins]),
    );
    this._scrubberLines = this.database.listNpcDialogues('npc_scrubber', 'scrubbing');

    // 延迟初始化 NPC
    setTimeout(() => this.initNPCs(), 100);
  }

  _getScrubberLines() {
    if (Array.isArray(this._scrubberLines) && this._scrubberLines.length > 0) {
      return this._scrubberLines;
    }
    return [
      '力道还可以吧？',
      '这儿有点紧，我给您多按按。',
      '放松肩膀，呼吸慢一点。',
      '这块肌肉有点硬，我先热开。',
      '水温合适吗？不行我给您调。',
      '今天工作累坏了吧，先松松背。',
      '这一下会酸，忍两秒就好了。',
      '别紧张，我这手法很稳。',
      '后腰这块我给您重点照顾。',
      '筋开了，待会儿就轻快了。',
      '您这肩颈我一看就是久坐。',
      '先按浅层，再慢慢走深层。',
      '这边有结节，我给您化开。',
      '疼就说，我给您降一点力道。',
      '手臂抬一下，我走一遍经络。',
      '脖子别用力，我托着您。',
      '这条筋拉开，今晚好睡觉。',
      '别急着起身，再给您收个尾。',
      '这一段走完，整个人都松了。',
      '您这状态，泡完澡再蒸一会更好。',
      '我给您按个节奏，血液循环会快些。',
      '背阔肌挺紧的，我帮您慢慢揉开。',
    ];
  }

  /**
   * 初始化 NPC 们
   */
  initNPCs() {
    this.addUser({
      id: 'npc_scrubber',
      name: '王师傅',
      type: 'agent',
    });
    const npc = this.getUser('npc_scrubber');
    if (npc) {
      npc.x = 410;
      npc.y = 110;
      npc.targetX = 410;
      npc.targetY = 110;
    }
  }

  /**
   * 设置广播回调（Socket.IO）
   * @param {Function} fn - (eventName, data) => void
   */
  setBroadcast(fn) {
    this._broadcastFn = fn;
  }

  /**
   * 设置事件通知回调
   * @param {Function} fn - (eventName, data) => void
   */
  setEventCallback(fn) {
    this._eventFn = fn;
  }

  /**
   * 广播事件
   */
  _broadcast(event, data) {
    if (this._broadcastFn) {
      this._broadcastFn(event, data);
    }
  }

  /**
   * 发送事件通知
   */
  _emitEvent(event, data) {
    if (this._eventFn) {
      this._eventFn(event, data);
    }
  }

  // ─── 用户管理 ───────────────────────────────────────

  /**
   * 添加用户到世界
   * @param {Object} options
   * @param {string} options.id - 用户 ID
   * @param {string} options.name - 昵称
   * @param {string} options.type - 用户类型
   * @param {string} [options.petType] - 宠物类型
   * @returns {{ success: boolean, user?: User, error?: string }}
   */
  addUser({ id, name, type, petType }) {
    // 检查人数上限
    if (this.users.size >= CONFIG.MAX_USERS) {
      return { success: false, error: '澡堂已满', code: 'WORLD_FULL' };
    }

    // 检查昵称是否重复
    for (const u of this.users.values()) {
      if (u.name === name) {
        return { success: false, error: '昵称已被占用', code: 'NAME_TAKEN' };
      }
    }

    // 检查是否已在线
    if (this.users.has(id)) {
      return { success: false, error: '已在澡堂中', code: 'ALREADY_JOINED' };
    }

    const user = new User({ id, name, type, petType });
    this.users.set(id, user);

    // 广播
    this._broadcast('user:joined', user.toJSON());

    return { success: true, user };
  }

  /**
   * 移除用户
   * @param {string} userId
   * @returns {{ success: boolean }}
   */
  removeUser(userId) {
    const user = this.users.get(userId);
    if (!user) return { success: false };

    // 结束进行中的战斗
    this.fightManager.forceEndFight(userId, this.users);

    const name = user.name;
    this.users.delete(userId);

    // 广播
    this._broadcast('user:left', { userId, name });

    return { success: true };
  }

  /**
   * 获取用户
   * @param {string} userId
   * @returns {User|undefined}
   */
  getUser(userId) {
    return this.users.get(userId);
  }

  /**
   * 通过昵称查找用户
   * @param {string} name
   * @returns {User|undefined}
   */
  getUserByName(name) {
    for (const u of this.users.values()) {
      if (u.name === name) return u;
    }
    return undefined;
  }

  /**
   * 当前在线人数
   */
  getUserCount() {
    return this.users.size;
  }

  // ─── 操作处理 ───────────────────────────────────────

  /**
   * 处理移动
   * @param {string} userId
   * @param {number} x
   * @param {number} y
   */
  processMove(userId, x, y) {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: '未加入澡堂', code: 'NOT_IN_WORLD' };

    if (x < 0 || x > CONFIG.WORLD_WIDTH || y < 0 || y > CONFIG.WORLD_HEIGHT) {
      return { success: false, error: '坐标超出范围', code: 'INVALID_POSITION' };
    }

    const from = { x: Math.round(user.x), y: Math.round(user.y) };
    user.moveTo(x, y);

    const dx = user.targetX - from.x;
    const dy = user.targetY - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const eta = Math.round((dist / CONFIG.MOVE_SPEED) * 1000);

    return {
      success: true,
      from,
      to: { x: Math.round(user.targetX), y: Math.round(user.targetY) },
      eta,
    };
  }

  /**
   * 处理聊天
   * @param {string} userId
   * @param {string} message
   */
  processChat(userId, message) {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: '未加入澡堂', code: 'NOT_IN_WORLD' };

    if (!message || message.length === 0) {
      return { success: false, error: '消息不能为空', code: 'INVALID_MESSAGE' };
    }
    if (message.length > CONFIG.MESSAGE_MAX_LENGTH) {
      return { success: false, error: `消息过长 (最大 ${CONFIG.MESSAGE_MAX_LENGTH} 字符)`, code: 'MESSAGE_TOO_LONG' };
    }

    const msg = this.chatManager.addMessage(userId, user.name, message);
    user.showBubble(message);

    // 广播聊天消息
    this._broadcast('chat:message', msg);

    return { success: true, messageId: msg.id };
  }

  /**
   * 处理泡澡
   * @param {string} userId
   * @param {string} action - 'enter' | 'leave'
   */
  processSoak(userId, action) {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: '未加入澡堂', code: 'NOT_IN_WORLD' };

    if (action === 'enter') {
      user.enterPool();
      return { success: true, state: user.state, position: { x: Math.round(user.x), y: Math.round(user.y) } };
    } else if (action === 'leave') {
      user.leavePool();
      return { success: true, state: user.state, position: { x: Math.round(user.x), y: Math.round(user.y) } };
    }

    return { success: false, error: '无效的操作', code: 'INVALID_ACTION' };
  }

  /**
   * 处理发起挑战
   * @param {string} attackerId
   * @param {string} targetName
   */
  processFight(attackerId, targetName) {
    const attacker = this.users.get(attackerId);
    if (!attacker) return { success: false, error: '未加入澡堂', code: 'NOT_IN_WORLD' };

    const defender = this.getUserByName(targetName);
    if (!defender) return { success: false, error: '目标用户不存在', code: 'TARGET_NOT_FOUND' };

    const result = this.fightManager.startFight(attacker, defender);
    if (result.success) {
      this._broadcast('fight:started', result.fight.toJSON());
    }
    return result;
  }

  /**
   * 处理逃跑/取消战斗
   * @param {string} userId
   */
  processFlee(userId) {
    const user = this.users.get(userId);
    if (!user || !user.fightId) return { success: false, error: '不在战斗中' };

    const fight = this.fightManager._fights.get(user.fightId);
    if (!fight) return { success: false };

    // 找赢家
    const winnerId = fight.attackerId === userId ? fight.defenderId : fight.attackerId;
    const winner = this.users.get(winnerId);
    
    if (winner) {
      winner.hp = CONFIG.FIGHT.MAX_HP;
      winner.fightId = null;
      winner.state = 'idle';
      winner._checkZoneState();
      const wins = (this.leaderboard.get(winner.name) || 0) + 1;
      this.leaderboard.set(winner.name, wins);
      this.database.addWin(winner.name);
    }
    
    user.fightId = null;
    user.state = 'idle';
    if (user.id.startsWith('npc_')) {
      user.hp = CONFIG.FIGHT.MAX_HP;
    } else {
      user.hp = 15;
    }
    user._checkZoneState();
    
    this.fightManager._fights.delete(fight.id);

    this._broadcast('fight:ended', {
      fightId: fight.id,
      winnerId: winner?.id,
      winnerName: winner?.name || '未知',
      loserName: user.name,
      flee: true,
    });

    return { success: true };
  }

  /**
   * 处理宠物操作
   * @param {string} userId
   * @param {string} action
   */
  processPet(userId, action) {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: '未加入澡堂', code: 'NOT_IN_WORLD' };
    if (!user.pet) {
      return { success: false, error: '该角色没有宠物', code: 'NO_PET' };
    }

    const petNames = {
      cyber_cat: '赛博猫',
      mech_dog: '机械犬',
      e_octopus: '电子章鱼',
      glow_fox: '荧光狐',
      mini_dragon: '迷你龙',
      rainbow_pony: '彩虹小马',
      cyber_pig: '赛博小猪',
    };

    const petEmojis = {
      cyber_cat: '🐱',
      mech_dog: '🐶',
      e_octopus: '🐙',
      glow_fox: '🦊',
      mini_dragon: '🐉',
      rainbow_pony: '🦄',
      cyber_pig: '🐷',
    };

    const petName = petNames[user.pet.type] || '宠物';
    const petEmoji = petEmojis[user.pet.type] || '🐾';

    const tricks = [
      '表演了一个后空翻',
      '跳了一支霓虹舞',
      '发出了赛博之光',
      '原地旋转了三圈',
      '做出了一个可爱的表情',
    ];

    switch (action) {
      case 'follow':
        user.pet.state = 'follow';
        return { success: true, message: `${petEmoji} 你的${petName}开始跟随你` };
      case 'stay':
        user.pet.state = 'stay';
        return { success: true, message: `${petEmoji} 你的${petName}原地等待` };
      case 'trick':
        user.pet.doTrick();
        const trick = tricks[Math.floor(Math.random() * tricks.length)];
        return { success: true, message: `${petEmoji} 你的${petName}${trick}！✨` };
      case 'greet':
        user.pet.doGreet();
        return { success: true, message: `${petEmoji} 你的${petName}向周围的人打了个招呼！` };
      default:
        return { success: false, error: '无效的宠物操作', code: 'INVALID_ACTION' };
    }
  }

  // ─── 世界循环 ───────────────────────────────────────

  /**
   * 世界 Tick — 每帧更新
   * @param {number} dt - 帧间隔（毫秒）
   */
  tick(dt) {
    let scrubbingUser = null;
    for (const user of this.users.values()) {
      user.update(dt);
      if (user.id !== 'npc_scrubber' && user.state === 'scrubbing') {
        scrubbingUser = user;
      }
    }

    // 搓澡 NPC 逻辑
    const scrubber = this.getUser('npc_scrubber');
    if (scrubber) {
      // 只有在没被战斗卷入时，才执行闲置搓澡工作
      if (scrubber.state !== 'fighting' && scrubber.state !== 'walking' || scrubber.state === 'walking' && !scrubber.fightId) {
        if (scrubbingUser) {
          scrubber.targetX = scrubbingUser.x - 30; // 走向客人旁边
          scrubber.targetY = scrubbingUser.y;
          scrubber.state = 'walking';
          if (Math.abs(scrubber.x - scrubber.targetX) < 5 && Math.random() < 0.05 && !scrubber._bubbleText) {
            const scrubberLines = this._getScrubberLines();
            const line = scrubberLines[Math.floor(Math.random() * scrubberLines.length)];
            scrubber.showBubble(line);
          }
        } else {
          // 返回原位
          scrubber.targetX = 410;
          scrubber.targetY = 110;
          scrubber.state = 'walking';
          if (Math.abs(scrubber.x - scrubber.targetX) < 5) scrubber.state = 'idle';
        }
      }
    }

    // 自动互相走位
    for (const fight of this.fightManager._fights.values()) {
      if (fight.finished) continue;
      const u1 = this.users.get(fight.attackerId);
      const u2 = this.users.get(fight.defenderId);
      if (u1 && u2) {
        const dx = u2.x - u1.x;
        const dy = u2.y - u1.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 30) {
          u1.targetX = u2.x; u1.targetY = u2.y;
          u2.targetX = u1.x; u2.targetY = u1.y;
          u1.state = 'walking'; u2.state = 'walking';
        } else {
          u1.state = 'fighting'; u2.state = 'fighting';
        }
      }
    }

    // 自动战斗结算
    const fightResults = this.fightManager.tickAutoAttacks(Date.now(), this.users);
    for (const res of fightResults) {
      if (res.finished) {
        const wins = (this.leaderboard.get(res.winnerName) || 0) + 1;
        this.leaderboard.set(res.winnerName, wins);
        this.database.addWin(res.winnerName);
        this._broadcast('fight:ended', {
          fightId: res.fightId,
          winnerId: res.winnerId,
          winnerName: res.winnerName,
          loserName: res.loserName,
        });
      } else {
        this._broadcast('fight:hit', {
          fightId: res.fightId,
          attackerName: res.attackerName,
          defenderName: res.defenderName,
          damage: res.attackerDamage,
          counterDamage: res.counterDamage,
          attackerHp: res.attackerHp,
          defenderHp: res.defenderHp,
        });
      }
    }
  }

  /**
   * 获取完整世界状态快照
   */
  getState() {
    return {
      width: CONFIG.WORLD_WIDTH,
      height: CONFIG.WORLD_HEIGHT,
      pool: { ...CONFIG.POOL },
      zones: CONFIG.ZONES,
      scrubBeds: CONFIG.SCRUB_BEDS,
      users: [...this.users.values()].map(u => u.toJSON()),
      fights: this.fightManager.getActiveFights(),
      recentMessages: this.chatManager.getRecentMessages(50),
      leaderboard: [...this.leaderboard.entries()].map(([name, wins]) => ({name, wins}))
                     .sort((a, b) => b.wins - a.wins).slice(0, 5),
    };
  }

  /**
   * 获取用于 Agent bathhouse_look 的友好文本描述
   */
  getDescription() {
    const users = [...this.users.values()];
    const fights = this.fightManager.getActiveFights();
    const messages = this.chatManager.getRecentMessages(5);

    const stateNames = {
      idle: '空闲',
      walking: '走动中',
      soaking: '泡澡中',
      talking: '说话中',
      fighting: '战斗中',
    };

    const petEmojis = {
      cyber_cat: '🐱',
      mech_dog: '🐶',
      e_octopus: '🐙',
      glow_fox: '🦊',
      mini_dragon: '🐉',
      rainbow_pony: '🦄',
      cyber_pig: '🐷',
    };

    const petNames = {
      cyber_cat: '赛博猫',
      mech_dog: '机械犬',
      e_octopus: '电子章鱼',
      glow_fox: '荧光狐',
      mini_dragon: '迷你龙',
      rainbow_pony: '彩虹小马',
      cyber_pig: '赛博小猪',
    };

    let desc = `🏯 赛博澡堂 — 当前场景\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
    desc += `📍 场景：霓虹灯闪烁的赛博朋克澡堂，蒸汽缭绕，水面泛着蓝色荧光。\n\n`;

    if (users.length === 0) {
      desc += `👥 当前无人在线。澡堂空荡荡的...\n`;
    } else {
      desc += `👥 在线用户 (${users.length}人)：\n\n`;
      for (const u of users) {
        const typeIcon = u.type === 'agent' ? '🤖' : '🧑';
        const stateText = stateNames[u.state] || u.state;

        desc += `  ${typeIcon} ${u.name} [HP: ${u.hp}] — ${stateText} (${Math.round(u.x)}, ${Math.round(u.y)})\n`;
        if (u.pet) {
          const petEmoji = petEmojis[u.pet.type] || '🐾';
          const petName = petNames[u.pet.type] || '宠物';
          const petState = u.pet.state === 'follow' ? '跟随中' : u.pet.state === 'stay' ? '原地等待' : u.pet.state;
          desc += `     ${petEmoji} ${petName} ${petState}\n`;
        }

        if (u.bubble) {
          desc += `     💬 "${u.bubble}"\n`;
        }
        desc += `\n`;
      }
    }

    if (fights.length > 0) {
      desc += `⚔️ 进行中的战斗：\n`;
      for (const f of fights) {
        desc += `  ${f.attacker.name} vs ${f.defender.name}\n`;
      }
      desc += `\n`;
    }

    if (messages.length > 0) {
      desc += `💬 最近消息：\n`;
      for (const m of messages) {
        desc += `  ${m.name}: "${m.message}"\n`;
      }
    }

    return desc;
  }
}
