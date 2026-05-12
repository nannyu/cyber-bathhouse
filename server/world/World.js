/**
 * 世界状态管理器 — 赛博澡堂核心
 */

import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from '../config.js';
import { User } from './User.js';
import { ChatManager } from './ChatManager.js';
import { FightManager } from './FightManager.js';
import { MatchAnalyzer } from '../combat/MatchAnalyzer.js';
import { FIGHT_PHASES } from '../combat/FightMatch.js';

export class World {
  constructor(database) {
    this.database = database;

    /** @type {Map<string, User>} userId → User */
    this.users = new Map();

    /** @type {ChatManager} */
    this.chatManager = new ChatManager(database);

    /** @type {FightManager} */
    this.fightManager = new FightManager();
    this.fightManager.setFightEconomyHooks({
      beforeFinalize: (fight, users) => this._settleFightEconomy(fight, users),
      onFightCancelled: (fight, users) => this._refundAllFightBets(fight, users),
    });

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
      // 幽默/接地气
      '搓完这一套，保您脱胎换骨。',
      '我干这行二十年了，闭着眼都能搓。',
      '您这皮肤底子好，一搓就亮。',
      '别看我手糙，搓出来的活儿细着呢。',
      '上次有个小伙子搓完直接睡着了。',
      '这叫"赛博推拿"，独家手法。',
      '搓澡搓的是身体，养的是精神。',
      '您放心躺着，剩下的交给我。',
      '我这手温是专门调过的，37.5度恒温。',
      '泡完澡不搓一下，等于白来。',
      // 关心/互动
      '最近是不是加班多？背都僵了。',
      '肩胛骨这里，我给您松一松。',
      '深呼吸，跟着我的节奏来。',
      '这一块淤堵比较严重，我慢慢来。',
      '搓完记得多喝点水，排排毒。',
      '您这体质，建议一周来两次。',
      '腰椎两侧我重点走一遍。',
      '翻个身，我给您搓搓前胸。',
      '好了好了，这块已经通了。',
      '感觉到热了吧？血液循环起来了。',
      // 赛博朋克风味
      '您这机械臂接口处也需要保养啊。',
      '赛博时代了，人还是得搓澡。',
      '再先进的义体也替代不了一次好搓澡。',
      '我这搓澡巾可是纳米纤维的。',
      '霓虹灯下搓澡，别有一番风味。',
      '数据跑得再快，身体也得慢下来。',
      // 老师傅唠嗑
      '我跟您说，搓澡这事儿急不得。',
      '您这后背，跟搓衣板似的，得下功夫。',
      '哎，今天第八位了，手艺没退步吧？',
      '我徒弟搓了三年还没我一半功力。',
      '老话说得好，千金难买一身轻。',
      '您闭眼歇着，我心里有数。',
      '这一搓下去，三天不累。',
      '我这双手啊，比任何仪器都准。',
      '搓澡不光是技术，还得有感情。',
      '您这泥搓出来都是赛博色的。',
      // 养生哲学
      '通则不痛，痛则不通，老祖宗的话。',
      '气血一通，百病不生。',
      '现代人就是缺这一搓。',
      '搓澡是最古老的排毒方式。',
      '皮肤是最大的器官，得伺候好。',
      '每一寸皮肤都值得被认真对待。',
      '搓完您再照镜子，保证不一样。',
      '养生第一步，先把身上的旧气搓掉。',
      // 吹牛/自信
      '我王师傅搓澡，从没有回头客不满意的。',
      '这条街上，就没有我搓不开的结。',
      '有人专门坐飞船来找我搓澡，信不？',
      '我这手法，申请过非遗的。',
      '隔壁澡堂的师傅都来偷师，没学会。',
      '搓完您就知道，什么叫物超所值。',
      // 日常闲聊
      '今天池子水温调得刚好，泡完再来。',
      '外面霓虹灯又换新的了，越来越花哨。',
      '昨天有个 AI 来搓澡，还挺配合。',
      '您是常客了吧？身体比上次松多了。',
      '搓完去休息区躺一会儿，别急着走。',
      '下次带朋友来，我给打个折。',
      // Vibe Coding 相关
      '写代码写累了吧？来，搓一搓，bug 自然就通了。',
      '您这肩膀硬得跟 legacy code 似的。',
      '搓澡就像重构，得一层一层来。',
      '放松，别想那些 PR review 了。',
      '我搓澡跟您写代码一样，讲究心流。',
      'Vibe coding 讲究氛围，搓澡也是。',
      '代码要 clean，身体也要 clean。',
      '这一搓，相当于给您的身体做了次 refactor。',
      '别 debug 了，先 debug 一下自己的身体。',
      '您这后背的结节，比技术债还顽固。',
      '搓完保您灵感爆发，一晚上写三个 feature。',
      '写代码靠 AI，搓澡还得靠我老王。',
      '我这手法就是人肉版的 Copilot。',
      '您就当这是给身体做一次 code review。',
      '紧张什么？又不是线上 P0 故障。',
      '搓澡不需要单元测试，效果立竿见影。',
      '我看您这个姿势，一坐就是八小时吧？',
      '程序员的肩颈问题，我见得多了。',
      '搓完这一套，手速至少快 20%。',
      '代码可以回滚，身体可不能，得保养。',
    ];
  }

  /**
   * 王师傅巡逻/闲置时的随机台词
   */
  _getScrubberIdleLines() {
    return [
      '来搓个澡吧，包您舒坦！',
      '走过路过不要错过，王师傅搓澡，童叟无欺！',
      '今天生意清淡啊…搓澡巾都凉了。',
      '这双手可是搓过上万人的。',
      '哎，年轻人都不爱搓澡了吗？',
      '我这手艺，祖传三代了。',
      '搓完澡再泡个温泉，赛过活神仙。',
      '看你肩膀那么僵，过来搓一搓？',
      '王师傅在此，谁来挑战我的搓功？',
      '闲着也是闲着，不如来搓一把。',
      '搓澡不花钱，回血还特快！',
      '我这搓澡巾是纳米材质的，高科技！',
      '赛博时代了，搓澡还得靠手工。',
      '别光泡着，搓一搓才通透。',
      '看那边打架的…打完了来我这搓搓。',
      '今天的水温不错，适合搓完再泡。',
      '我王师傅搓澡，从不让客人失望。',
      '哼哼…这搓澡巾该换新的了。',
      '有没有人要搓背？买一送一…开玩笑的。',
      '站了一天了，腰有点酸…不过来客人我立马精神！',
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
      // 王师傅的战斗人格：稳健型，爱用投技破防
      npc.combatPersonality = {
        style: 'throw_mixup',
        risk: 0.5,
        preferredRange: 'close',
        meterPolicy: 'save_for_kill',
        ultimatePolicy: 'confirm_only',
      };
    }
  }

  /**
   * 设置广播回调（Socket.IO）
   * @param {Function} fn - (eventName, data) => void
   */
  setBroadcast(fn) {
    this._broadcastFn = fn;
    if (this.fightManager?.setBroadcast) {
      this.fightManager.setBroadcast(fn);
    }
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
  addUser({ id, name, type, petType, coins: coinsArg }) {
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

    let resolvedCoins = coinsArg;
    if (typeof resolvedCoins !== 'number' || !Number.isFinite(resolvedCoins)) {
      if (typeof id === 'string' && id.startsWith('npc_')) {
        resolvedCoins = 0;
      } else {
        const fromDb = this.database.getCoinsByUserId(id);
        resolvedCoins = fromDb ?? CONFIG.ECONOMY.INITIAL_COINS;
      }
    }

    const petProfile = !String(id).startsWith('npc_')
      ? this.database.getPetByOwnerUserId(id)
      : null;
    const user = new User({ id, name, type, petType, petProfile, coins: resolvedCoins });
    if (petProfile) {
      this.applyPetProfileToUser(user, petProfile);
    }
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

  applyPetProfileToUser(user, petProfile) {
    if (!user?.pet || !petProfile) return user;
    user.pet.applyProfile(petProfile);
    return user;
  }

  _getAgentPetContext(agentToken) {
    if (!agentToken) {
      return { success: false, error: '需要 Agent Token', code: 'AUTH_REQUIRED' };
    }
    if (Date.now() > agentToken.expiresAt) {
      return { success: false, error: 'Agent Token 无效或过期', code: 'AUTH_REQUIRED' };
    }

    const petProfile = this.database.getPetById(agentToken.petId);
    if (!petProfile) {
      return { success: false, error: '宠物不存在', code: 'PET_NOT_FOUND' };
    }
    const binding = this.database.getAgentBindingByPetId(agentToken.petId);
    if (!binding || binding.agentId !== agentToken.agentId) {
      return { success: false, error: 'Agent token 没有绑定宠物', code: 'AGENT_NOT_BOUND' };
    }
    if (binding.status !== 'active') {
      return { success: false, error: '主人已断开 Agent', code: 'BINDING_REVOKED' };
    }

    const owner = this.users.get(petProfile.ownerUserId);
    if (owner?.pet) {
      this.applyPetProfileToUser(owner, petProfile);
    }
    return { success: true, petProfile, binding, owner, pet: owner?.pet || null };
  }

  _requireAgentControlled(ctx) {
    if (ctx.petProfile.controlMode !== 'agent_controlled') {
      return { success: false, error: '主人尚未开启 Agent 接管', code: 'AGENT_CONTROL_DISABLED' };
    }
    if (!ctx.owner || !ctx.pet) {
      return { success: false, error: '主人未加入澡堂', code: 'NOT_IN_WORLD' };
    }
    return null;
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

    // 擂台有战斗时，无关人员不得进入擂台区域
    const arena = CONFIG.ZONES.ARENA;
    const targetInArena = arena && x >= arena.x && x <= arena.x + arena.width &&
      y >= arena.y && y <= arena.y + arena.height;
    if (targetInArena && !user.fightId && !user._arenaExitPending) {
      // 检查是否有正在进行的战斗
      const hasActiveFight = this.fightManager.getActiveFights().length > 0;
      if (hasActiveFight) {
        return { success: false, error: '擂台正在比赛中，请在外围观战', code: 'ARENA_BLOCKED' };
      }
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
   * 处理搓澡请求 — 玩家靠近王师傅时触发
   * @param {string} userId
   */
  processScrub(userId) {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: '未加入澡堂', code: 'NOT_IN_WORLD' };

    if (user.state === 'fighting' || user.state === 'awaiting_fight' || user.state === 'walking_to_arena') {
      return { success: false, error: '战斗中无法搓澡', code: 'ALREADY_FIGHTING' };
    }

    if (user.state === 'scrubbing') {
      return { success: false, error: '正在搓澡中', code: 'ALREADY_SCRUBBING' };
    }

    // 检查王师傅是否正在给别人搓澡
    for (const u of this.users.values()) {
      if (u.id !== userId && u.id !== 'npc_scrubber' && u.state === 'scrubbing' && u._scrubTimer > 0) {
        return { success: false, error: `王师傅正在给「${u.name}」搓澡，请稍等`, code: 'SCRUBBER_BUSY' };
      }
    }

    // 检查是否靠近王师傅（或正在走向王师傅）
    const scrubber = this.getUser('npc_scrubber');
    if (!scrubber) return { success: false, error: '王师傅不在', code: 'NPC_NOT_FOUND' };

    const dx = user.x - scrubber.x;
    const dy = user.y - scrubber.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 也检查移动目标是否靠近王师傅（角色可能还在走路途中）
    const tdx = user.targetX - scrubber.x;
    const tdy = user.targetY - scrubber.y;
    const targetDist = Math.sqrt(tdx * tdx + tdy * tdy);

    const range = CONFIG.SCRUB?.PROXIMITY_RANGE || 120;

    if (dist > range && targetDist > range) {
      return { success: false, error: '离王师傅太远了，走近一点吧', code: 'TOO_FAR' };
    }

    // 如果还在走路中，先等到达再开始搓澡：强制设置位置到王师傅旁边
    if (user.state === 'walking' || dist > 60) {
      user.x = scrubber.x + 30;
      user.y = scrubber.y;
      user.targetX = user.x;
      user.targetY = user.y;
    }

    // 开始搓澡
    const started = user.startScrubbing();
    if (!started) {
      return { success: false, error: '无法开始搓澡', code: 'INVALID_STATE' };
    }

    // 王师傅说话
    const scrubberLines = this._getScrubberLines();
    const line = scrubberLines[Math.floor(Math.random() * scrubberLines.length)];
    scrubber.showBubble(line);

    // 广播搓澡开始事件
    this._broadcast('scrub:started', {
      userId: user.id,
      userName: user.name,
      scrubberLine: line,
      duration: CONFIG.SCRUB?.DURATION || 8000,
    });

    return {
      success: true,
      message: `🧖 王师傅开始给你搓澡了！「${line}」`,
      duration: CONFIG.SCRUB?.DURATION || 8000,
      healPerTick: CONFIG.SCRUB?.HEAL_PER_TICK || 10,
      tickInterval: CONFIG.SCRUB?.TICK_INTERVAL || 500,
    };
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
   * 观战下注（仅非上场玩家；fight:start 起 CONFIG.ECONOMY.BETTING_WINDOW_MS 内有效）
   * @param {string} userId
   * @param {{ fightId: string, side: 'attacker'|'defender', amount: number }} payload
   */
  processFightBet(userId, payload) {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: '未加入澡堂', code: 'NOT_IN_WORLD' };
    if (typeof userId === 'string' && userId.startsWith('npc_')) {
      return { success: false, error: '无法下注', code: 'NOT_ALLOWED' };
    }

    const fightId = payload?.fightId;
    const side = payload?.side;
    const amountRaw = payload?.amount;
    const amt = Math.floor(Number(amountRaw));
    if (!fightId || typeof fightId !== 'string') {
      return { success: false, error: '缺少 fightId', code: 'INVALID_FIGHT' };
    }
    if (side !== 'attacker' && side !== 'defender') {
      return { success: false, error: 'side 须为 attacker 或 defender', code: 'INVALID_SIDE' };
    }
    if (!Number.isFinite(amt) || amt < CONFIG.ECONOMY.BET_MIN || amt > CONFIG.ECONOMY.BET_MAX) {
      return {
        success: false,
        error: `下注金额须在 ${CONFIG.ECONOMY.BET_MIN}-${CONFIG.ECONOMY.BET_MAX} 之间`,
        code: 'INVALID_BET_AMOUNT',
      };
    }

    const fight = this.fightManager.getFightById(fightId);
    if (!fight) return { success: false, error: '对局不存在', code: 'FIGHT_NOT_FOUND' };
    if (fight.phase !== FIGHT_PHASES.ACTIVE) {
      return { success: false, error: '当前不可下注', code: 'BETTING_CLOSED' };
    }
    const now = Date.now();
    if (!fight.bettingEndsAt || now > fight.bettingEndsAt) {
      return { success: false, error: '下注时间已结束', code: 'BETTING_CLOSED' };
    }
    if (userId === fight.attackerId || userId === fight.defenderId) {
      return { success: false, error: '上场选手不能下注', code: 'FIGHTER_CANNOT_BET' };
    }

    const prev = fight.bets.get(userId);
    const prevAmt = prev?.amount || 0;
    const delta = amt - prevAmt;
    const dbCoins = this.database.getCoinsByUserId(userId) ?? 0;
    if (delta > dbCoins) {
      return { success: false, error: '金币不足', code: 'INSUFFICIENT_COINS' };
    }

    try {
      this.database.runInTransaction(() => {
        if (prevAmt > 0) {
          const r1 = this.database.adjustCoinsByUserId(userId, prevAmt);
          if (!r1.success) throw new Error('REFUND_FAIL');
        }
        const r2 = this.database.adjustCoinsByUserId(userId, -amt);
        if (!r2.success) throw new Error('DEDUCT_FAIL');
      });
    } catch {
      return { success: false, error: '下注失败', code: 'BET_FAILED' };
    }

    try {
      fight.bets.set(userId, { side, amount: amt });
    } catch (e) {
      this._revertFightBetDbAfterMapFailure(userId, amt, prevAmt, fight.id);
      return {
        success: false,
        error: '下注状态写入失败，金币已尝试冲正',
        code: 'BET_STATE_FAIL',
      };
    }

    let fresh;
    try {
      fresh = this.database.getCoinsByUserId(userId);
      if (fresh != null) user.coins = fresh;
    } catch (e) {
      console.error('[economy] processFightBet sync coins failed', userId, fight.id, e?.message || e);
    }

    try {
      const pool = fight.getBettingSummary();
      this._broadcast('fight:bet:pool', { fightId: fight.id, ...pool });
    } catch (e) {
      console.error('[economy] fight:bet:pool broadcast failed', fight.id, e?.message || e);
    }

    return {
      success: true,
      fightId: fight.id,
      side,
      amount: amt,
      coins: user.coins,
      pool: fight.getBettingSummary(),
    };
  }

  /**
   * DB 已按新注扣款，但内存 bets 写入失败时，冲正：`+(amt - prevAmt)` 与事务内 `+prevAmt`、`-amt` 的净效果相反。
   */
  _revertFightBetDbAfterMapFailure(userId, amt, prevAmt, fightId) {
    const net = amt - prevAmt;
    if (!net) return;
    try {
      this.database.runInTransaction(() => {
        const r = this.database.adjustCoinsByUserId(userId, net);
        if (!r.success) throw new Error('COMPENSATE_FAIL');
      });
      const c = this.database.getCoinsByUserId(userId);
      if (c != null) this._applyCoinsToOnlineUser(userId, c);
    } catch (e) {
      console.error(
        '[economy] CRITICAL: fight bet map failed and compensate failed',
        { userId, fightId, amt, prevAmt, net, err: e?.message || e },
      );
    }
  }

  _applyCoinsToOnlineUser(userId, coins) {
    const u = this.users.get(userId);
    if (u && typeof coins === 'number' && Number.isFinite(coins)) u.coins = Math.max(0, Math.floor(coins));
  }

  /**
   * 全额退回本场下注（逃跑 / forceEnd / 平局等）。单事务：任一条失败则整笔回滚，且不清 bets 映射。
   */
  _refundAllFightBets(fight, _users) {
    if (!fight?.bets?.size) return;
    const uids = [...fight.bets.keys()];
    try {
      this.database.runInTransaction(() => {
        for (const [uid, bet] of [...fight.bets.entries()]) {
          const r = this.database.adjustCoinsByUserId(uid, bet.amount);
          if (!r.success) throw new Error(`REFUND_CANCEL:${uid}`);
        }
      });
      for (const uid of uids) {
        const c = this.database.getCoinsByUserId(uid);
        if (c != null) this._applyCoinsToOnlineUser(uid, c);
      }
      fight.bets.clear();
    } catch (e) {
      console.error('[economy] _refundAllFightBets failed', fight?.id, e?.message || e);
    }
  }

  /**
   * @returns {{ kind: 'none' } | { kind: 'refund_all' } | { kind: 'payout', payouts: { uid: string, payout: number }[] }}
   */
  _computeParimutuelPlan(fight) {
    const Ta = fight.sumStake('attacker');
    const Td = fight.sumStake('defender');
    const pool = Ta + Td;
    if (pool <= 0) return { kind: 'none' };

    const winSide = fight.winnerId === fight.attackerId ? 'attacker' : 'defender';
    const Tw = winSide === 'attacker' ? Ta : Td;
    if (Tw <= 0) return { kind: 'refund_all' };

    const entries = [...fight.bets.entries()]
      .filter(([, b]) => b.side === winSide)
      .sort((a, b) => a[0].localeCompare(b[0]));
    if (entries.length === 0) return { kind: 'refund_all' };

    const payouts = entries.map(([uid, bet]) => ({
      uid,
      payout: Math.floor((pool * bet.amount) / Tw),
    }));
    const sumP = payouts.reduce((s, p) => s + p.payout, 0);
    let rem = pool - sumP;
    let i = 0;
    while (rem > 0 && payouts.length > 0) {
      payouts[i % payouts.length].payout += 1;
      rem -= 1;
      i += 1;
    }
    return { kind: 'payout', payouts };
  }

  /**
   * 终局经济：平局仅退款；非平局在同一 DB 事务内完成胜负赏金 + 奖池派彩或全额退回，成功后再清 bets 并标记已结算。
   */
  _settleFightEconomy(fight, users) {
    if (fight._economySettled) return;

    const syncIds = new Set();
    try {
      this.database.runInTransaction(() => {
        if (fight.finishOutcome === 'draw') {
          for (const [uid, bet] of [...fight.bets.entries()]) {
            const r = this.database.adjustCoinsByUserId(uid, bet.amount);
            if (!r.success) throw new Error(`REFUND_DRAW:${uid}`);
            syncIds.add(uid);
          }
          return;
        }

        const wId = fight.winnerId;
        const lId = fight.loserId;
        if (wId && !String(wId).startsWith('npc_')) {
          const r = this.database.adjustCoinsByUserId(wId, CONFIG.ECONOMY.FIGHT_WIN_COINS);
          if (!r.success) throw new Error(`WIN:${wId}`);
          syncIds.add(wId);
        }
        if (lId && !String(lId).startsWith('npc_')) {
          const cur = this.database.getCoinsByUserId(lId) ?? 0;
          const dec = Math.min(CONFIG.ECONOMY.FIGHT_LOSS_COINS, cur);
          if (dec > 0) {
            const r = this.database.adjustCoinsByUserId(lId, -dec);
            if (!r.success) throw new Error(`LOSS:${lId}`);
            syncIds.add(lId);
          }
        }

        const plan = this._computeParimutuelPlan(fight);
        if (plan.kind === 'refund_all') {
          for (const [uid, bet] of [...fight.bets.entries()]) {
            const r = this.database.adjustCoinsByUserId(uid, bet.amount);
            if (!r.success) throw new Error(`REFUND_POOL:${uid}`);
            syncIds.add(uid);
          }
        } else if (plan.kind === 'payout') {
          for (const { uid, payout } of plan.payouts) {
            if (payout <= 0) continue;
            const r = this.database.adjustCoinsByUserId(uid, payout);
            if (!r.success) throw new Error(`PAYOUT:${uid}`);
            syncIds.add(uid);
          }
        }
      });

      for (const uid of syncIds) {
        const c = this.database.getCoinsByUserId(uid);
        if (c != null) this._applyCoinsToOnlineUser(uid, c);
      }
      fight.bets.clear();
      fight._economySettled = true;
    } catch (e) {
      console.error('[economy] _settleFightEconomy failed', fight?.id, e?.message || e);
    }
  }

  /**
   * Queue an attack intent for the next combat tick.
   * @param {string} userId
   */
  processAttack(userId) {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: '未加入澡堂', code: 'NOT_IN_WORLD' };
    if (!user.fightId) return { success: false, error: '不在战斗中', code: 'NOT_FIGHTING' };

    this.fightManager.queueAttackIntent(userId);
    return { success: true, message: '攻击意图已提交，将在下一帧执行' };
  }

  /**
   * 保存 Agent 的高层战术计划。
   * @param {string} userId
   * @param {Object} plan
   */
  processCombatPlan(userId, plan) {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: '未加入澡堂', code: 'NOT_IN_WORLD' };

    const savedPlan = this.fightManager.combatEngine.policyManager.setPlan(userId, plan || {});
    return { success: true, plan: savedPlan };
  }

  /**
   * Queue a combat intent for the next tick.
   * @param {string} userId
   * @param {Object} action
   */
  processCombatAction(userId, action = {}) {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: '未加入澡堂', code: 'NOT_IN_WORLD' };
    if (!user.fightId) {
      if (user.lastFightResult?.finished) {
        return { success: true, ...user.lastFightResult };
      }
      return { success: false, error: '不在战斗中', code: 'NOT_FIGHTING' };
    }

    this.fightManager.combatEngine.policyManager.queueIntent(userId, {
      intent: action.intent,
      skillId: action.skill_id || action.skillId,
    });
    const fight = this.fightManager.getFightByUser(userId);
    if (fight) {
      const queuedEvent = fight.recordEvent('intent:queued', {
        fighterId: userId,
        intent: action.intent,
        skillId: action.skill_id || action.skillId || null,
      });
      this.database.recordFightEvent(queuedEvent);
    }
    return {
      success: true,
      message: '战斗意图已提交，将在下一帧执行',
      attackerSkillId: action.skill_id || action.skillId || null,
      yourRage: user.rage || 0,
      finished: false,
    };
  }

  /**
   * 查询战斗结果和回放事件。
   * @param {string} matchId
   * @param {number} limit
   */
  getCombatReplay(matchId, limit = 500) {
    const match = this.database.getFightMatch(matchId);
    if (!match) return { success: false, error: '战斗不存在', code: 'MATCH_NOT_FOUND' };
    const events = this.database.listFightEvents(matchId, limit);
    return { success: true, match, events };
  }

  /**
   * 获取当前战斗快照。
   * @param {string} userId
   */
  getCombatState(userId) {
    const user = this.users.get(userId);
    if (!user) return { success: false, error: '未加入澡堂', code: 'NOT_IN_WORLD' };
    const fight = this.fightManager.getFightByUser(userId);
    if (!fight) return { success: false, error: '不在战斗中', code: 'NOT_FIGHTING' };

    return {
      success: true,
      match: fight.getSnapshot(),
      selfId: userId,
      opponentId: fight.getOpponentId(userId),
    };
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
      winner.rage = 0;
      winner.rageState = 'charging';
      winner.fightId = null;
      winner.state = 'idle';
      this.fightManager._resetCombatVisuals(winner);
      winner._checkZoneState();
      const wins = (this.leaderboard.get(winner.name) || 0) + 1;
      this.leaderboard.set(winner.name, wins);
      this.database.addWin(winner.name);
    }

    user.fightId = null;
    user.state = 'idle';
    user.rage = 0;
    user.rageState = 'charging';
    this.fightManager._resetCombatVisuals(user);
    if (user.id.startsWith('npc_')) {
      user.hp = CONFIG.FIGHT.MAX_HP;
    } else {
      user.hp = 15;
    }
    user._checkZoneState();

    this._refundAllFightBets(fight, this.users);
    this.fightManager._fights.delete(fight.id);

    this._broadcast('fight:ended', {
      fightId: fight.id,
      winnerId: winner?.id,
      loserId: user.id,
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

  processPetRecall(ownerUserId, { follow = true } = {}) {
    const user = this.users.get(ownerUserId);
    if (!user) return { success: false, error: '未加入澡堂', code: 'NOT_IN_WORLD' };
    if (!user.pet) return { success: false, error: '该角色没有宠物', code: 'NO_PET' };
    const profile = this.database.getPetByOwnerUserId(ownerUserId);
    if (!profile) return { success: false, error: '宠物不存在', code: 'PET_NOT_FOUND' };

    user.pet.x = user.x + 12;
    user.pet.y = user.y + 8;
    user.pet.moveTo(user.pet.x, user.pet.y);
    let updated = profile;
    if (follow) {
      updated = this.database.updatePetControlMode(profile.id, 'follow');
      user.pet.setControlMode('follow');
    }
    this.applyPetProfileToUser(user, updated);
    this._broadcast('pet:recalled', {
      ownerUserId,
      petId: updated.id,
      controlMode: updated.controlMode,
    });
    return { success: true, pet: user.pet.toJSON() };
  }

  processPetDisconnectAgent(ownerUserId) {
    const profile = this.database.getPetByOwnerUserId(ownerUserId);
    if (!profile) return { success: false, error: '宠物不存在', code: 'PET_NOT_FOUND' };
    const binding = this.database.revokeAgentBindingForPet(profile.id);
    const updated = this.database.updatePetControlMode(profile.id, 'follow');
    const user = this.users.get(ownerUserId);
    if (user?.pet) {
      this.applyPetProfileToUser(user, updated);
    }
    return { success: true, binding };
  }

  processAgentPetStatus(agentToken) {
    const ctx = this._getAgentPetContext(agentToken);
    if (!ctx.success) return ctx;
    return {
      success: true,
      pet: ctx.pet ? ctx.pet.toJSON() : {
        id: ctx.petProfile.id,
        nickname: ctx.petProfile.petNickname,
        type: ctx.petProfile.petType,
        controlMode: ctx.petProfile.controlMode,
      },
      owner: ctx.owner ? {
        id: ctx.owner.id,
        name: ctx.owner.name,
        online: true,
        x: Math.round(ctx.owner.x),
        y: Math.round(ctx.owner.y),
      } : {
        id: ctx.petProfile.ownerUserId,
        online: false,
      },
      binding: ctx.binding,
      settings: {
        controlMode: ctx.petProfile.controlMode,
        heartbeatEnabled: !!ctx.petProfile.heartbeatEnabled,
        heartbeatFrequency: ctx.petProfile.heartbeatFrequency,
        publicSpeechEnabled: !!ctx.petProfile.publicSpeechEnabled,
        lastAgentHeartbeatAt: ctx.petProfile.lastAgentHeartbeatAt,
        lastAgentActionAt: ctx.petProfile.lastAgentActionAt,
      },
    };
  }

  processAgentPetLook(agentToken) {
    const ctx = this._getAgentPetContext(agentToken);
    if (!ctx.success) return ctx;
    const petX = ctx.pet?.x ?? ctx.owner?.x ?? 0;
    const petY = ctx.pet?.y ?? ctx.owner?.y ?? 0;
    const nearbyUsers = [...this.users.values()]
      .filter((u) => u.id !== ctx.petProfile.ownerUserId)
      .map((u) => ({
        id: u.id,
        name: u.name,
        type: u.type,
        state: u.state,
        x: Math.round(u.x),
        y: Math.round(u.y),
        distance: Math.round(Math.hypot(u.x - petX, u.y - petY)),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8);
    return {
      success: true,
      pet: ctx.pet ? ctx.pet.toJSON() : null,
      owner: ctx.owner ? { id: ctx.owner.id, name: ctx.owner.name, x: Math.round(ctx.owner.x), y: Math.round(ctx.owner.y), online: true } : { id: ctx.petProfile.ownerUserId, online: false },
      nearbyUsers,
      recentMessages: this.chatManager.getRecentMessages(10),
    };
  }

  processAgentPetHeartbeat(agentToken, payload = {}) {
    const ctx = this._getAgentPetContext(agentToken);
    if (!ctx.success) return ctx;
    const now = Date.now();
    const petProfile = this.database.updatePetAgentHeartbeat(ctx.petProfile.id, now);
    this.database.updateAgentBindingHeartbeat(ctx.petProfile.id, now);
    if (ctx.owner?.pet) {
      ctx.owner.pet.lastAgentHeartbeatAt = now;
    }

    const intervals = {
      quiet: 5 * 60 * 1000,
      standard: 2 * 60 * 1000,
      active: 45 * 1000,
    };
    const activityInterval = intervals[petProfile.heartbeatFrequency] || intervals.standard;
    const activityDue = !!petProfile.heartbeatEnabled
      && petProfile.controlMode === 'agent_controlled'
      && (!petProfile.lastAgentActionAt || now - petProfile.lastAgentActionAt >= activityInterval);

    return {
      success: true,
      pet: {
        controlMode: petProfile.controlMode,
        heartbeatEnabled: !!petProfile.heartbeatEnabled,
        publicSpeechEnabled: !!petProfile.publicSpeechEnabled,
      },
      nextHeartbeatMs: 30000,
      activityDue,
      suggestedActions: activityDue ? ['look', 'move', 'say', 'emote'] : [],
      received: {
        status: payload.status || 'online',
        mood: payload.mood || null,
        lastAction: payload.last_action || payload.lastAction || null,
      },
    };
  }

  processAgentPetMove(agentToken, payload = {}) {
    const ctx = this._getAgentPetContext(agentToken);
    if (!ctx.success) return ctx;
    const controlError = this._requireAgentControlled(ctx);
    if (controlError) return controlError;
    const x = Number(payload.x);
    const y = Number(payload.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > CONFIG.WORLD_WIDTH || y < 0 || y > CONFIG.WORLD_HEIGHT) {
      return { success: false, error: '坐标超出范围', code: 'INVALID_POSITION' };
    }

    const from = { x: Math.round(ctx.pet.x), y: Math.round(ctx.pet.y) };
    ctx.pet.moveTo(x, y);
    ctx.pet.setControlMode('agent_controlled');
    const updated = this.database.updatePetAgentAction(ctx.petProfile.id);
    this.applyPetProfileToUser(ctx.owner, updated);
    return {
      success: true,
      from,
      to: { x: Math.round(ctx.pet.targetX), y: Math.round(ctx.pet.targetY) },
      pet: ctx.pet.toJSON(),
    };
  }

  processAgentPetSay(agentToken, payload = {}) {
    const ctx = this._getAgentPetContext(agentToken);
    if (!ctx.success) return ctx;
    const controlError = this._requireAgentControlled(ctx);
    if (controlError) return controlError;
    if (!ctx.petProfile.publicSpeechEnabled) {
      return { success: false, error: '宠物不允许公开发言', code: 'PUBLIC_SPEECH_DISABLED' };
    }
    const message = typeof payload.message === 'string' ? payload.message.trim() : '';
    if (!message) return { success: false, error: '消息不能为空', code: 'INVALID_MESSAGE' };
    if (message.length > CONFIG.MESSAGE_MAX_LENGTH) {
      return { success: false, error: `消息过长 (最大 ${CONFIG.MESSAGE_MAX_LENGTH} 字符)`, code: 'MESSAGE_TOO_LONG' };
    }

    const msg = this.chatManager.addMessage(ctx.petProfile.ownerUserId, ctx.petProfile.petNickname, message, {
      senderType: 'pet',
      petId: ctx.petProfile.id,
      ownerUserId: ctx.petProfile.ownerUserId,
    });
    ctx.pet.showBubble(message);
    const updated = this.database.updatePetAgentAction(ctx.petProfile.id, { publicSpeech: true });
    this.applyPetProfileToUser(ctx.owner, updated);
    this._broadcast('chat:message', msg);
    return { success: true, messageId: msg.id, message: msg, pet: ctx.pet.toJSON() };
  }

  processAgentPetEmote(agentToken, payload = {}) {
    const ctx = this._getAgentPetContext(agentToken);
    if (!ctx.success) return ctx;
    const controlError = this._requireAgentControlled(ctx);
    if (controlError) return controlError;
    const action = payload.action || 'trick';
    if (action === 'greet') {
      ctx.pet.doGreet();
      ctx.pet.showBubble('你好呀。');
    } else {
      ctx.pet.doTrick();
      ctx.pet.showBubble('看我表演一个小动作。');
    }
    const updated = this.database.updatePetAgentAction(ctx.petProfile.id);
    this.applyPetProfileToUser(ctx.owner, updated);
    return { success: true, pet: ctx.pet.toJSON() };
  }

  processAgentPetReturn(agentToken) {
    const ctx = this._getAgentPetContext(agentToken);
    if (!ctx.success) return ctx;
    if (!ctx.owner || !ctx.pet) {
      return { success: false, error: '主人未加入澡堂', code: 'NOT_IN_WORLD' };
    }
    return this.processPetRecall(ctx.petProfile.ownerUserId, { follow: true });
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

      // 战斗结束后延迟自动离开擂台
      if (user._arenaExitPending && user._postDefeatDelay > 0) {
        user._postDefeatDelay -= dt;
        if (user._postDefeatDelay <= 0) {
          user._arenaExitPending = false;
          // 自动走出擂台到附近空闲区域
          const arena = CONFIG.ZONES.ARENA;
          if (user.id.startsWith('npc_')) {
            // NPC 走回原位（由 NPC AI 处理）
          } else {
            // 玩家走到擂台上方
            const exitX = arena.x + Math.random() * arena.width;
            const exitY = arena.y - 40 - Math.random() * 30;
            user.moveTo(exitX, exitY);
          }
        }
      }
    }

    // 搓澡 NPC 逻辑 — 仅当不在战斗/排队/走入场地时跑闲置 AI
    const scrubber = this.getUser('npc_scrubber');
    if (scrubber && !scrubber.fightId) {
      // 被击败后延迟恢复
      if (scrubber._postDefeatDelay > 0) {
        scrubber._postDefeatDelay -= dt;
        // 延迟期间不做任何事，保持原地不动
      } else {
        const idleAI = scrubber.state !== 'fighting'
          && scrubber.state !== 'awaiting_fight'
          && scrubber.state !== 'walking_to_arena';
        if (idleAI) {
          if (scrubbingUser) {
            // 搓澡时沿着客人身体从头到脚来回走动
            if (!this._scrubberPatrolDir) this._scrubberPatrolDir = 1;
            if (!this._scrubberPatrolTimer) this._scrubberPatrolTimer = 0;

            const headX = scrubbingUser.x - 15;  // 头部位置
            const footX = scrubbingUser.x + 15;  // 脚部位置
            const patrolY = scrubbingUser.y;

            this._scrubberPatrolTimer += dt;
            // 每 1.5 秒换方向（从头到脚或从脚到头）
            if (this._scrubberPatrolTimer >= 1500) {
              this._scrubberPatrolTimer = 0;
              this._scrubberPatrolDir *= -1;
            }

            // 目标位置根据方向在头脚之间切换
            const targetX = this._scrubberPatrolDir > 0 ? footX : headX;
            scrubber.targetX = targetX;
            scrubber.targetY = patrolY;

            // 判断是否在客人身旁范围内（开始搓澡动画）
            const nearUser = Math.abs(scrubber.y - patrolY) < 15 &&
              scrubber.x >= headX - 10 && scrubber.x <= footX + 10;
            if (nearUser) {
              scrubber.state = 'walking'; // 保持走动状态（来回移动）
              scrubber.actionState = 'npc_scrubbing';
            } else {
              scrubber.state = 'walking';
              scrubber.actionState = 'idle';
            }

            // 每 2 秒说一句随机台词（单次搓澡不重复）
            if (!this._scrubberTalkTimer) this._scrubberTalkTimer = 0;
            if (!this._scrubberUsedLines) this._scrubberUsedLines = new Set();
            this._scrubberTalkTimer += dt;
            if (this._scrubberTalkTimer >= 2000) {
              this._scrubberTalkTimer = 0;
              const scrubberLines = this._getScrubberLines();
              // 过滤掉已说过的台词
              const available = scrubberLines.filter(l => !this._scrubberUsedLines.has(l));
              // 如果全部说完了，重置（不太可能，78条够15秒用）
              const pool = available.length > 0 ? available : scrubberLines;
              const line = pool[Math.floor(Math.random() * pool.length)];
              this._scrubberUsedLines.add(line);
              scrubber.showBubble(line);
            }
          } else {
            // 没人搓澡时重置计时器和动画
            this._scrubberTalkTimer = 0;
            this._scrubberUsedLines = null;
            this._scrubberPatrolDir = 1;
            this._scrubberPatrolTimer = 0;
            scrubber.actionState = 'idle';

            // 没有人在搓澡时，检查是否有人靠近王师傅（自动招揽）
            const range = CONFIG.SCRUB?.PROXIMITY_RANGE || 120;
            let nearbyUser = null;
            for (const u of this.users.values()) {
              if (u.id === 'npc_scrubber') continue;
              if (u.state === 'fighting' || u.state === 'scrubbing' || u.state === 'walking') continue;
              const dx = u.x - scrubber.x;
              const dy = u.y - scrubber.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < range) {
                nearbyUser = u;
                break;
              }
            }
            if (nearbyUser && !scrubber._bubbleText && Math.random() < 0.02) {
              const idleLines = this._getScrubberIdleLines();
              const line = idleLines[Math.floor(Math.random() * idleLines.length)];
              scrubber.showBubble(line);
            }

            // 无人靠近时也偶尔自言自语
            if (!nearbyUser && !scrubber._bubbleText && Math.random() < 0.005) {
              const idleLines = this._getScrubberIdleLines();
              const line = idleLines[Math.floor(Math.random() * idleLines.length)];
              scrubber.showBubble(line);
            }

            // 返回原位
            scrubber.targetX = 410;
            scrubber.targetY = 110;
            scrubber.state = 'walking';
            if (Math.abs(scrubber.x - scrubber.targetX) < 5) scrubber.state = 'idle';
          }
        }
      } // end postDefeatDelay else
    }

    // 战斗 staging + 自动战斗结算（state 由 FightManager 管控：
    // awaiting_fight / walking_to_arena / fighting）
    const fightResults = this.fightManager.tickAutoAttacks(Date.now(), this.users, dt);
    for (const res of fightResults) {
      for (const event of res.events || []) {
        this._broadcast('fight:event', event);
        this.database.recordFightEvent(event);
      }
      if (res.finished) {
        if (res.winnerName && !res.isDraw) {
          const wins = (this.leaderboard.get(res.winnerName) || 0) + 1;
          this.leaderboard.set(res.winnerName, wins);
          this.database.addWin(res.winnerName);
        }
        // Generate enhanced match summary with MatchAnalyzer
        const match = this.fightManager._fights.get(res.fightId);
        let summary = res;
        if (match) {
          const analyzer = new MatchAnalyzer();
          summary = {
            ...res,
            analysis: analyzer.analyze(match),
          };
        }
        this._recordFightMatch(summary);
        this._broadcast('fight:ended', {
          fightId: res.fightId,
          winnerId: res.winnerId,
          loserId: res.loserId,
          winnerName: res.winnerName,
          loserName: res.loserName,
          isDraw: !!res.isDraw,
          finishOutcome: res.finishOutcome || null,
          analysis: summary.analysis,
        });
      } else {
        this._broadcast('fight:hit', {
          fightId: res.fightId,
          attackerName: res.attackerName,
          defenderName: res.defenderName,
          attackerDamage: res.attackerDamage,
          damage: res.attackerDamage,
          counterDamage: res.counterDamage,
          attackerHp: res.attackerHp,
          defenderHp: res.defenderHp,
          attackerRage: res.attackerRage,
          defenderRage: res.defenderRage,
          attackerSkillId: res.attackerSkillId,
          defenderSkillId: res.defenderSkillId,
        });
      }
    }

    for (const fight of this.fightManager._fights.values()) {
      if (!fight.finished) {
        this._broadcast('fight:snapshot', fight.getSnapshot());
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
      leaderboard: [...this.leaderboard.entries()].map(([name, wins]) => ({ name, wins }))
        .sort((a, b) => b.wins - a.wins).slice(0, 5),
    };
  }

  _recordFightMatch(result) {
    if (!result?.finished) return;
    this.database.recordFightMatch({
      id: result.fightId,
      fighterAId: result.attackerId,
      fighterAName: result.attackerName,
      fighterBId: result.defenderId,
      fighterBName: result.defenderName,
      winnerId: result.winnerId,
      winnerName: result.winnerName,
      loserId: result.loserId,
      loserName: result.loserName,
      durationMs: result.durationMs || 0,
      seed: result.seed || 0,
      summary: {
        lastAttackerDamage: result.attackerDamage,
        lastCounterDamage: result.counterDamage,
        attackerSkillId: result.attackerSkillId,
        defenderSkillId: result.defenderSkillId,
        attackerIntent: result.attackerIntent,
        defenderIntent: result.defenderIntent,
        eventCount: result.events?.length || 0,
      },
      createdAt: Date.now(),
      finishedAt: Date.now(),
    });
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

    let desc = `🏯 星露澡堂 — 当前场景\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
    desc += `📍 场景：温馨木质结构的星露谷风格澡堂，大理石水池波光粼粼，周围有独立的淋浴、桑拿和休息区。\n\n`;

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
