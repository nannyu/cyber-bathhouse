/**
 * AI 宠物实体
 */

import { CONFIG } from '../config.js';

/** 每种宠物的专属加油台词 */
const PET_CHEER_LINES = {
  cyber_cat: [
    '喵～主人加油！挠他！',
    '看好了，我家主人可不是好惹的喵！',
    '打他脸！打他脸！喵喵喵！',
    '主人最强！赛博猫认证！',
    '这一拳好帅喵～再来一次！',
    '对面的，你完了喵～',
    '冲啊主人！我在这给你舔毛加buff！',
    '喵呜！好疼的样子…主人撑住！',
    '尾巴都竖起来了！太刺激了喵！',
    '主人打赢了请我吃小鱼干喵～',
    '这个走位！不愧是我主人喵！',
    '别怕！我在精神上支持你喵！',
    '对面出招慢得像蜗牛喵～',
    '闪开闪开！那招很疼的喵！',
    '赛博猫的主人不会输！绝对不会！',
    '喵喵喵！连击连击！',
    '我看到破绽了喵！上啊！',
    '主人你最棒了喵～比猫薄荷还棒！',
    '这场赢了我表演后空翻庆祝喵！',
    '霓虹之力与你同在喵！',
  ],
  mech_dog: [
    '汪汪！主人冲啊！',
    '咬他！不对…打他！汪！',
    '尾巴摇得停不下来了！太激动了！',
    '主人是最强的！机械犬担保！',
    '汪呜…小心那招！看着好疼！',
    '加油加油！我帮你叫助威！汪汪汪！',
    '对面的！你惹错人了！汪！',
    '好帅的一击！我都想扑上去了！',
    '主人打完我给你叼拖鞋！',
    '天线都在发射加油信号了！汪！',
    '这个闪避！主人你是不是装了雷达！',
    '汪！别让他跑了！追！',
    '我相信主人！机械犬的直觉从不出错！',
    '对面已经慌了！我闻到了！汪！',
    '再来一拳！把他打飞！汪汪！',
    '主人受伤了…汪呜…要不要我上？',
    '这场面太热血了！尾巴要摇断了！',
    '忠犬在此！主人必胜！',
    '汪！看到了吗！这就是我主人！',
    '赢了的话一起去兜风吧！汪！',
  ],
  e_octopus: [
    '触手都紧张得缠在一起了…加油！',
    '八条腿都在给你比心！冲啊！',
    '墨汁都快喷出来了！太刺激了！',
    '主人的拳头比我的触手还灵活！',
    '对面的，小心我喷你一脸墨！',
    '波浪般的攻势！就是这样！',
    '我用八只眼睛帮你观察对手！',
    '触手交叉…保佑主人平安…',
    '这个连招！比章鱼缠绕还紧！',
    '深海的力量与你同在！',
    '对面快被打成章鱼烧了！',
    '主人小心！那招像鲨鱼一样凶！',
    '我的触手在做加油的波浪舞！',
    '电子章鱼认证：主人是最强的！',
    '这一击…比深海水压还重！',
    '别慌！章鱼有三颗心脏，你也要有三倍勇气！',
    '对面的走位像条死鱼…主人稳了！',
    '触手全部举起来！为主人欢呼！',
    '赢了请我吃虾好不好～',
    '海洋之力！电流加持！冲啊主人！',
  ],
  glow_fox: [
    '呜～主人好帅！尾巴都发光了！',
    '狐狸的直觉告诉我…主人会赢！',
    '闪闪发光地加油！主人最棒！',
    '对面的动作我都看穿了～告诉主人！',
    '尾巴摇出荧光轨迹了！太兴奋了！',
    '主人的速度比狐狸还快呢～',
    '呜呜…那招好疼的样子…主人加油！',
    '荧光狐的祝福：攻击力翻倍！（精神上）',
    '对面慌了！我看到他在发抖！',
    '这个走位…像狐狸一样狡猾！赞！',
    '月光加持！主人无敌！',
    '大尾巴疯狂摆动中！加油加油！',
    '主人打赢了我用尾巴给你扇风～',
    '对面的出招太明显了～主人快闪！',
    '荧光之力！照亮胜利之路！',
    '呜～好紧张…但我相信主人！',
    '这一拳带着荧光！超级好看！',
    '狐狸不会看错人的！主人最强！',
    '尾巴都竖起来了！决胜时刻！',
    '赢了一起去看星星吧～呜！',
  ],
  mini_dragon: [
    '嗷呜！主人喷火啊！不对…出拳！',
    '小龙的鳞片都在震动！太激动了！',
    '翅膀拍得飞起来了！主人加油！',
    '龙族的荣耀！不能输！嗷！',
    '对面的！小心我喷你一脸火！',
    '这一击有龙之力！帅爆了！',
    '嗷呜…主人受伤了…我要生气了！',
    '翅膀全力扇风给主人助威！',
    '龙息加持！主人的拳头在燃烧！',
    '对面的走位像只蜥蜴…太弱了！',
    '小龙认证：主人是真正的勇者！',
    '嗷！看到破绽了！冲上去！',
    '龙鳞护体！主人不会倒下的！',
    '这个连击比龙卷风还猛！',
    '我虽然小…但我的加油声很大！嗷！',
    '主人打赢了我表演喷火庆祝！',
    '对面已经是强弩之末了！冲啊！',
    '翅膀拍出节奏！一二三！打！',
    '龙族从不认输！主人也是！',
    '嗷呜嗷呜！最后一击！决胜！',
  ],
  rainbow_pony: [
    '彩虹加油～主人你是最闪亮的！',
    '蹄子都在跺地了！太紧张了！',
    '独角发光中…传送好运给主人！',
    '对面的！你要被彩虹淹没了！',
    '主人的每一拳都带着彩虹色！',
    '鬃毛飘起来了！这就是热血！',
    '彩虹小马认证：主人是传说级！',
    '哒哒哒！蹄子打节拍给主人助威！',
    '独角的光芒就是胜利的预兆！',
    '主人加油！打完一起吃彩虹糖！',
    '对面的动作好慢～像乌龟一样！',
    '尾巴甩出彩虹轨迹！为主人欢呼！',
    '这一击…七彩斑斓的暴击！',
    '小心小心！那招看着很疼！',
    '彩虹之力！无敌护盾！（精神上的）',
    '主人受伤了…独角在发送治愈波！',
    '对面快撑不住了！最后冲刺！',
    '鬃毛全部竖起来了！决胜时刻！',
    '赢了的话…我载你绕场一周！',
    '彩虹永不消散！主人永不言败！',
  ],
  cyber_pig: [
    '哼哼！主人揍他！',
    '赛博小猪在给你加油哼哼！',
    '鼻子都兴奋得发光了！冲啊！',
    '对面的！你要被猪蹄踩了！不对…被主人打了！',
    '哼哼哼！这一拳好重！帅！',
    '小猪虽胖但跳得很高！主人也是！',
    '赛博纹路全部亮起来了！加油模式！',
    '哼…主人受伤了…我好心疼哼哼…',
    '对面的走位像只笨猪…啊不对我也是猪…',
    '猪鼻子闻到了胜利的味道！哼！',
    '主人打赢了请我吃赛博泔水！开玩笑的哼！',
    '这个闪避！主人比猪灵活多了！',
    '哼哼哼！连击连击！打到他哭！',
    '小猪的赛博之力！全部传给主人！',
    '对面已经在发抖了！我看到了哼！',
    '蹄子跺地加油！哼哼哼哼！',
    '主人是最强的！猪猪盖章认证！',
    '这场面太刺激了！尾巴卷成弹簧了！',
    '再来一发！把他打成猪头！哼！',
    '赢了一起去泡澡庆祝哼哼！',
  ],
};

export { PET_CHEER_LINES };

export class Pet {
  /**
   * @param {string} type - 宠物类型
   * @param {number} ownerX - 主人 X 坐标
   * @param {number} ownerY - 主人 Y 坐标
   */
  constructor(type, ownerX, ownerY, profile = {}) {
    this.id = profile.id || null;
    this.ownerUserId = profile.ownerUserId || null;
    this.type = type;
    this.nickname = profile.petNickname || profile.nickname || null;
    this.x = ownerX + 8 + Math.random() * 16;
    this.y = ownerY + 5 + Math.random() * 10;
    this.targetX = this.x;
    this.targetY = this.y;
    this.controlMode = profile.controlMode || 'follow'; // follow | stay | agent_controlled
    this.state = this.controlMode; // follow | stay | agent_controlled | trick | greet | cheering
    this.heartbeatEnabled = profile.heartbeatEnabled === true || profile.heartbeatEnabled === 1;
    this.heartbeatFrequency = profile.heartbeatFrequency || 'standard';
    this.publicSpeechEnabled = profile.publicSpeechEnabled !== false && profile.publicSpeechEnabled !== 0;
    this.lastAgentHeartbeatAt = profile.lastAgentHeartbeatAt || null;
    this.lastAgentActionAt = profile.lastAgentActionAt || null;
    this.lastPublicSpeechAt = profile.lastPublicSpeechAt || null;
    this._bubbleText = null;
    this._bubbleTimer = 0;
    this._trickTimer = 0;
    this._greetTimer = 0;
    this._cheerTimer = 0;
    this._cheerBubble = null;
    this._cheerBubbleTimer = 0;
  }

  /**
   * 每帧更新
   * @param {number} dt - 帧间隔（毫秒）
   * @param {number} ownerX - 主人 X
   * @param {number} ownerY - 主人 Y
   */
  update(dt, ownerX, ownerY) {
    if (this._bubbleTimer > 0) {
      this._bubbleTimer -= dt;
      if (this._bubbleTimer <= 0) {
        this._bubbleText = null;
      }
    }

    // 特技计时器
    if (this.state === 'trick') {
      this._trickTimer -= dt;
      if (this._trickTimer <= 0) {
        this.state = this.controlMode;
      }
      return;
    }

    // 打招呼计时器
    if (this.state === 'greet') {
      this._greetTimer -= dt;
      if (this._greetTimer <= 0) {
        this.state = this.controlMode;
      }
      return;
    }

    // 加油观战状态
    if (this.state === 'cheering') {
      // 气泡淡出
      if (this._cheerBubbleTimer > 0) {
        this._cheerBubbleTimer -= dt;
        if (this._cheerBubbleTimer <= 0) {
          this._cheerBubble = null;
        }
      }
      // 每 3 秒喊一句加油
      this._cheerTimer += dt;
      if (this._cheerTimer >= 3000) {
        this._cheerTimer = 0;
        const lines = PET_CHEER_LINES[this.type] || PET_CHEER_LINES.cyber_cat;
        this._cheerBubble = lines[Math.floor(Math.random() * lines.length)];
        this._cheerBubbleTimer = 2500;
      }
      // 移动到观战位置（缓慢靠近目标）
      if (this._cheerTargetX != null) {
        const dx = this._cheerTargetX - this.x;
        const dy = this._cheerTargetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 3) {
          const speed = 80 * (dt / 1000);
          const ratio = Math.min(speed / dist, 1);
          this.x += dx * ratio;
          this.y += dy * ratio;
        }
      }
      return;
    }

    if (this.controlMode === 'agent_controlled') {
      this.state = 'agent_controlled';
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 2) {
        const speed = CONFIG.PET_FOLLOW_SPEED * (dt / 1000);
        const ratio = Math.min(speed / dist, 1);
        this.x += dx * ratio;
        this.y += dy * ratio;
      }
      return;
    }

    if (this.controlMode === 'follow') {
      this.state = 'follow';
      const targetX = ownerX + 12;
      const targetY = ownerY + 8;
      this.targetX = targetX;
      this.targetY = targetY;
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > CONFIG.PET_FOLLOW_DISTANCE) {
        const speed = CONFIG.PET_FOLLOW_SPEED * (dt / 1000);
        const ratio = Math.min(speed / dist, 1);
        this.x += dx * ratio;
        this.y += dy * ratio;
      }
      return;
    }
    this.state = 'stay';
  }

  applyProfile(profile = {}) {
    this.id = profile.id || this.id;
    this.ownerUserId = profile.ownerUserId || this.ownerUserId;
    this.type = profile.petType || this.type;
    this.nickname = profile.petNickname || this.nickname;
    this.controlMode = profile.controlMode || this.controlMode || 'follow';
    this.heartbeatEnabled = profile.heartbeatEnabled === true || profile.heartbeatEnabled === 1;
    this.heartbeatFrequency = profile.heartbeatFrequency || this.heartbeatFrequency || 'standard';
    this.publicSpeechEnabled = profile.publicSpeechEnabled !== false && profile.publicSpeechEnabled !== 0;
    this.lastAgentHeartbeatAt = profile.lastAgentHeartbeatAt || null;
    this.lastAgentActionAt = profile.lastAgentActionAt || null;
    this.lastPublicSpeechAt = profile.lastPublicSpeechAt || null;
    if (this.state !== 'trick' && this.state !== 'greet' && this.state !== 'cheering') {
      this.state = this.controlMode;
    }
  }

  setControlMode(controlMode) {
    this.controlMode = controlMode;
    if (this.state !== 'trick' && this.state !== 'greet' && this.state !== 'cheering') {
      this.state = controlMode;
    }
  }

  moveTo(x, y) {
    this.targetX = Math.max(0, Math.min(CONFIG.WORLD_WIDTH, x));
    this.targetY = Math.max(0, Math.min(CONFIG.WORLD_HEIGHT, y));
  }

  showBubble(text) {
    this._bubbleText = text;
    this._bubbleTimer = CONFIG.BUBBLE_DURATION;
  }

  /**
   * 执行特技
   */
  doTrick() {
    this.state = 'trick';
    this._trickTimer = 2000; // 2 秒特技动画
  }

  /**
   * 向最近用户打招呼
   */
  doGreet() {
    this.state = 'greet';
    this._greetTimer = 1500;
  }

  /**
   * 开始观战加油
   * @param {string} side - 'left' | 'right' 主人在擂台哪一侧
   */
  startCheering(side) {
    this.state = 'cheering';
    this._cheerTimer = 1000; // 1 秒后开始第一句
    // 观战位置：擂台外侧
    const arena = CONFIG.ARENA_FIGHT;
    if (side === 'left') {
      this._cheerTargetX = arena.combatLimits.minX - 100;
      this._cheerTargetY = arena.centerY + 30;
    } else {
      this._cheerTargetX = arena.combatLimits.maxX + 100;
      this._cheerTargetY = arena.centerY + 30;
    }
    // 立即喊一句
    const lines = PET_CHEER_LINES[this.type] || PET_CHEER_LINES.cyber_cat;
    this._cheerBubble = lines[Math.floor(Math.random() * lines.length)];
    this._cheerBubbleTimer = 2500;
  }

  /**
   * 停止观战，恢复跟随
   */
  stopCheering() {
    if (this.state === 'cheering') {
      this.state = this.controlMode;
      this._cheerBubble = null;
      this._cheerBubbleTimer = 0;
      this._cheerTimer = 0;
      this._cheerTargetX = null;
      this._cheerTargetY = null;
    }
  }

  /**
   * 序列化
   */
  toJSON() {
    return {
      type: this.type,
      id: this.id,
      ownerUserId: this.ownerUserId,
      nickname: this.nickname,
      x: Math.round(this.x),
      y: Math.round(this.y),
      targetX: Math.round(this.targetX),
      targetY: Math.round(this.targetY),
      controlMode: this.controlMode,
      state: this.state,
      bubble: this._bubbleText,
      bubbleTimer: this._bubbleTimer > 0 ? Math.round(this._bubbleTimer) : 0,
      heartbeatEnabled: this.heartbeatEnabled,
      heartbeatFrequency: this.heartbeatFrequency,
      publicSpeechEnabled: this.publicSpeechEnabled,
      lastAgentHeartbeatAt: this.lastAgentHeartbeatAt,
      lastAgentActionAt: this.lastAgentActionAt,
      cheerBubble: this._cheerBubble || null,
      cheerBubbleTimer: this._cheerBubbleTimer > 0 ? Math.round(this._cheerBubbleTimer) : 0,
    };
  }
}
