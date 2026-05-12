import fs from 'fs';
import path from 'path';
import DatabaseDriver from 'better-sqlite3';
import { CONFIG } from '../config.js';

function generatePetCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `PET-${segment()}-${segment()}`;
}

const MIGRATIONS = [
  {
    version: 1,
    description: 'create core tables',
    sql: `
      CREATE TABLE IF NOT EXISTS accounts (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        nickname TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_messages(timestamp);

      CREATE TABLE IF NOT EXISTS leaderboard (
        name TEXT PRIMARY KEY,
        wins INTEGER NOT NULL DEFAULT 0
      );
    `,
  },
  {
    version: 2,
    description: 'add roles pets bindings and admin settings',
    sql: `
      CREATE TABLE IF NOT EXISTS pets (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL UNIQUE,
        pet_code TEXT NOT NULL UNIQUE,
        pet_type TEXT NOT NULL,
        pet_nickname TEXT NOT NULL,
        chat_visibility TEXT NOT NULL DEFAULT 'public',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_bindings (
        id TEXT PRIMARY KEY,
        pet_id TEXT NOT NULL UNIQUE,
        owner_user_id TEXT NOT NULL,
        agent_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        updated_by TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id TEXT PRIMARY KEY,
        admin_user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        detail TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_invites (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        pet_id TEXT NOT NULL,
        invite_code_hash TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        max_uses INTEGER NOT NULL,
        used_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_tokens (
        token TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        pet_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS private_threads (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        pet_id TEXT NOT NULL,
        binding_id TEXT,
        last_message_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS private_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        sender_type TEXT NOT NULL,
        sender_user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_private_messages_thread_created
      ON private_messages(thread_id, created_at);
    `,
  },
  {
    version: 3,
    description: 'add pet combat lines table',
    sql: `
      CREATE TABLE IF NOT EXISTS pet_combat_lines (
        id TEXT PRIMARY KEY,
        pet_type TEXT NOT NULL,
        line_type TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pet_combat_unique
      ON pet_combat_lines(pet_type, line_type, text);
      CREATE INDEX IF NOT EXISTS idx_pet_combat_type
      ON pet_combat_lines(pet_type, line_type);
    `,
  },
  {
    version: 4,
    description: 'add npc dialogues table',
    sql: `
      CREATE TABLE IF NOT EXISTS npc_dialogues (
        id TEXT PRIMARY KEY,
        npc_id TEXT NOT NULL,
        scene TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_npc_dialogues_unique
      ON npc_dialogues(npc_id, scene, text);
      CREATE INDEX IF NOT EXISTS idx_npc_dialogues_scene
      ON npc_dialogues(npc_id, scene);
    `,
  },
  {
    version: 5,
    description: 'add fight match and event records',
    sql: `
      CREATE TABLE IF NOT EXISTS fight_matches (
        id TEXT PRIMARY KEY,
        fighter_a_id TEXT NOT NULL,
        fighter_a_name TEXT NOT NULL,
        fighter_b_id TEXT NOT NULL,
        fighter_b_name TEXT NOT NULL,
        winner_id TEXT,
        winner_name TEXT,
        loser_id TEXT,
        loser_name TEXT,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        seed INTEGER NOT NULL DEFAULT 0,
        summary_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        finished_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_fight_matches_created
      ON fight_matches(created_at);

      CREATE TABLE IF NOT EXISTS fight_events (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL,
        frame INTEGER NOT NULL,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_fight_events_match_frame
      ON fight_events(match_id, frame);
    `,
  },
  {
    version: 6,
    description: 'accounts coins for economy and betting',
    sql: `
      ALTER TABLE accounts ADD COLUMN coins INTEGER NOT NULL DEFAULT ${CONFIG.ECONOMY.INITIAL_COINS};
    `,
  },
];

const DEFAULT_COMBAT_LINES = {
  cyber_cat: {
    attack: [
      '喵影突袭，电光爪！', '猫步迷踪，瞬间贴脸！', '瞄准弱点，喵拳连打！', '喵爪超频，撕开破绽！', '夜视锁定，扑杀！',
      '猫猫冲刺，划你一下！', '电子猫尾，横扫！', '低姿突进，连环抓挠！', '喵能激发，快拳出击！', '别眨眼，喵拳到了！',
    ],
    counter: [
      '喵？你先吃我一爪！', '猫反应可不是盖的！', '轻巧转身，反击到位！', '你慢了半拍，喵！', '柔韧闪避后反扑！',
      '尾巴一甩，回敬你！', '猫步绕后，反打！', '我的节奏你学不来！', '喵星防反，成立！', '你出手，我拆招！',
    ],
  },
  mech_dog: {
    attack: [
      '机械犬模式：冲锋撕咬！', '动力核心过载，正面突破！', '锁定目标，钢牙突进！', '液压前爪，重击！', '推进器点火，突刺！',
      '伺服马达全开，压上！', '装甲撞击，吃我一下！', '红外瞄准，必中一击！', '金属犬吼，震慑冲锋！', '齿轮咬合，连击开始！',
    ],
    counter: [
      '防御协议启动，反制！', '机械回路重启，反扑！', '后置推进器，回击！', '撞针反弹，打回去！', '装甲偏转，顺势反攻！',
      '你的角度被我算到了！', '系统判定：现在轮到我！', '制动后摆尾，反击！', '护板吸收，火力回敬！', '机械犬反咬，成立！',
    ],
  },
  e_octopus: {
    attack: [
      '电子触手，缠绕压制！', '八臂并发，连续输出！', '电波喷射，命中！', '触须封位，连环拍击！', '墨云干扰，贴脸突袭！',
      '多线程进攻，别想喘气！', '蓝电触点，麻痹一击！', '环绕缠打，压你节奏！', '触手锁喉，重压！', '深海回路，瞬时爆发！',
    ],
    counter: [
      '触手反卷，别想跑！', '多线程反击，接招！', '蓝电脉冲，回敬你！', '你被我包围了！', '反向缠绕，翻盘！',
      '海流借力，打回去！', '触须弹反，精准命中！', '电容回灌，反打！', '你这一拳被我卸了！', '八爪齐动，反制完成！',
    ],
  },
  glow_fox: {
    attack: [
      '狐火一闪，穿心突刺！', '荧光尾扫，速度制胜！', '魅影穿梭，打你措手不及！', '幻影步，三连打！', '狐焰点燃，爆发！',
      '轻身跃击，快准狠！', '尾焰回旋，命中！', '狐影分身，压迫你！', '灵动突脸，节奏断你！', '霓光掠影，一击即退！',
    ],
    counter: [
      '狐影回旋，反咬一口！', '尾焰点燃，反击开始！', '你追不上我的节奏！', '狐步侧闪，回敬！', '幻尾格挡后反刺！',
      '借你力道，打你破绽！', '霓光一闪，回马枪！', '狐狸可不会白挨打！', '轻盈后撤，瞬间反扑！', '你的空档被我抓到了！',
    ],
  },
  mini_dragon: {
    attack: [
      '龙息喷发，灼烧一击！', '小龙摆尾，震开你！', '鳞甲冲锋，硬碰硬！', '龙爪连撕，压制！', '火花吐息，贴脸！',
      '腾跃俯冲，猛龙突击！', '龙翼拍击，震你后退！', '逆鳞连打，发力！', '小龙怒吼，气势压制！', '烈焰滚动，冲你正面！',
    ],
    counter: [
      '龙威反震，给我退！', '逆鳞触发，反打！', '腾空回旋，龙爪回敬！', '火焰护体，反击！', '你惹怒小龙了！',
      '龙尾借势，横扫！', '鳞甲弹开，马上回击！', '俯冲折返，反扑！', '龙息倒灌，回敬你！', '这一击，龙族尊严！',
    ],
  },
  rainbow_pony: {
    attack: [
      '彩虹冲刺，角刺突进！', '小马飞踢，彩光命中！', '鬃毛电弧，闪击！', '七色踏步，连击开始！', '虹光撞角，顶你！',
      '轻灵跃击，正中！', '彩带尾扫，破防！', '小马冲锋，速度压制！', '彩虹轨迹，贴脸切入！', '梦幻重踏，出击！',
    ],
    counter: [
      '彩虹折返，反手一顶！', '别小看小马的爆发！', '七色回旋，回敬你！', '角盾弹开，反击！', '彩光闪避后回踢！',
      '小马可不吃亏！', '虹弧回击，打你破绽！', '轻跃转身，反冲！', '七彩尾焰，回敬！', '你追我？先挨这下！',
    ],
  },
  cyber_pig: {
    attack: [
      '猪头冲锋，顶你个趔趄！', '看我猪鼻拱击！', '赛博猪猪，猛撞出击！', '哼哼加速，顶飞你！', '猪耳一抖，重头槌！',
      '钢化猪鼻，正面突破！', '肉弹战车，开冲！', '猪蹄连踏，压过去！', '哼哼怒顶，不讲道理！', '猪头摆动，连环撞！',
    ],
    counter: [
      '谁说猪不会反打？', '猪头一甩，反冲！', '哼哼，轮到我顶你了！', '猪鼻卸力，立刻回敬！', '别欺负猪，后果自负！',
      '胖是储能，反击更狠！', '你这一拳，我拿脸接！', '猪蹄回旋，打回去！', '哼哼反扑，命中！', '猪头护体，回顶！',
    ],
  },
};

const DEFAULT_NPC_DIALOGUES = {
  npc_scrubber: {
    scrubbing: [
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
    ],
  },
};

export class Database {
  /**
   * @param {() => void} fn
   */
  runInTransaction(fn) {
    this.db.transaction(fn)();
  }

  constructor(dbPath) {
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });

    this.db = new DatabaseDriver(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this._runMigrations();
    this._prepareStatements();
  }

  _runMigrations() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      )
    `);

    const getAppliedStmt = this.db.prepare(`
      SELECT version
      FROM schema_migrations
    `);
    const applied = new Set(getAppliedStmt.all().map((row) => row.version));
    const markAppliedStmt = this.db.prepare(`
      INSERT INTO schema_migrations (version, description, applied_at)
      VALUES (?, ?, ?)
    `);

    const applyMigration = this.db.transaction((migration) => {
      this.db.exec(migration.sql);
      markAppliedStmt.run(migration.version, migration.description, Date.now());
    });

    for (const migration of MIGRATIONS) {
      if (!applied.has(migration.version)) {
        applyMigration(migration);
      }
    }

    this._ensureColumn('accounts', 'role', "ALTER TABLE accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
    this._ensureColumn(
      'accounts',
      'coins',
      `ALTER TABLE accounts ADD COLUMN coins INTEGER NOT NULL DEFAULT ${CONFIG.ECONOMY.INITIAL_COINS}`,
    );
    this._ensureColumn('sessions', 'role', "ALTER TABLE sessions ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
    this._ensureColumn('pets', 'chat_visibility', "ALTER TABLE pets ADD COLUMN chat_visibility TEXT NOT NULL DEFAULT 'public'");
    this._ensureColumn('pets', 'control_mode', "ALTER TABLE pets ADD COLUMN control_mode TEXT NOT NULL DEFAULT 'follow'");
    this._ensureColumn('pets', 'heartbeat_enabled', "ALTER TABLE pets ADD COLUMN heartbeat_enabled INTEGER NOT NULL DEFAULT 0");
    this._ensureColumn('pets', 'heartbeat_frequency', "ALTER TABLE pets ADD COLUMN heartbeat_frequency TEXT NOT NULL DEFAULT 'standard'");
    this._ensureColumn('pets', 'public_speech_enabled', "ALTER TABLE pets ADD COLUMN public_speech_enabled INTEGER NOT NULL DEFAULT 1");
    this._ensureColumn('pets', 'last_agent_heartbeat_at', "ALTER TABLE pets ADD COLUMN last_agent_heartbeat_at INTEGER");
    this._ensureColumn('pets', 'last_agent_action_at', "ALTER TABLE pets ADD COLUMN last_agent_action_at INTEGER");
    this._ensureColumn('pets', 'last_public_speech_at', "ALTER TABLE pets ADD COLUMN last_public_speech_at INTEGER");
    this._ensureColumn('agent_bindings', 'last_seen_at', "ALTER TABLE agent_bindings ADD COLUMN last_seen_at INTEGER");
    this._ensureColumn('agent_bindings', 'client_name', "ALTER TABLE agent_bindings ADD COLUMN client_name TEXT");
    this._ensureColumn('chat_messages', 'sender_type', "ALTER TABLE chat_messages ADD COLUMN sender_type TEXT NOT NULL DEFAULT 'user'");
    this._ensureColumn('chat_messages', 'pet_id', "ALTER TABLE chat_messages ADD COLUMN pet_id TEXT");
    this._ensureColumn('chat_messages', 'owner_user_id', "ALTER TABLE chat_messages ADD COLUMN owner_user_id TEXT");
    this._ensureCoreTables();
  }

  _ensureColumn(tableName, columnName, alterSql) {
    const columns = this.db.prepare(`PRAGMA table_info(${tableName})`).all();
    if (!columns.some((column) => column.name === columnName)) {
      this.db.exec(alterSql);
    }
  }

  _ensureCoreTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_invites (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        pet_id TEXT NOT NULL,
        invite_code_hash TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        max_uses INTEGER NOT NULL,
        used_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_tokens (
        token TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        pet_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS private_threads (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        pet_id TEXT NOT NULL,
        binding_id TEXT,
        last_message_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS private_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        sender_type TEXT NOT NULL,
        sender_user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_private_messages_thread_created
      ON private_messages(thread_id, created_at);

      CREATE TABLE IF NOT EXISTS pet_combat_lines (
        id TEXT PRIMARY KEY,
        pet_type TEXT NOT NULL,
        line_type TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pet_combat_unique
      ON pet_combat_lines(pet_type, line_type, text);
      CREATE INDEX IF NOT EXISTS idx_pet_combat_type
      ON pet_combat_lines(pet_type, line_type);

      CREATE TABLE IF NOT EXISTS npc_dialogues (
        id TEXT PRIMARY KEY,
        npc_id TEXT NOT NULL,
        scene TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_npc_dialogues_unique
      ON npc_dialogues(npc_id, scene, text);
      CREATE INDEX IF NOT EXISTS idx_npc_dialogues_scene
      ON npc_dialogues(npc_id, scene);

      CREATE TABLE IF NOT EXISTS fight_matches (
        id TEXT PRIMARY KEY,
        fighter_a_id TEXT NOT NULL,
        fighter_a_name TEXT NOT NULL,
        fighter_b_id TEXT NOT NULL,
        fighter_b_name TEXT NOT NULL,
        winner_id TEXT,
        winner_name TEXT,
        loser_id TEXT,
        loser_name TEXT,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        seed INTEGER NOT NULL DEFAULT 0,
        summary_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        finished_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_fight_matches_created
      ON fight_matches(created_at);

      CREATE TABLE IF NOT EXISTS fight_events (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL,
        frame INTEGER NOT NULL,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_fight_events_match_frame
      ON fight_events(match_id, frame);
    `);
  }

  _prepareStatements() {
    this._insertAccountStmt = this.db.prepare(`
      INSERT INTO accounts (username, password, nickname, user_id, role, coins)
      VALUES (@username, @password, @nickname, @userId, @role, @coins)
    `);

    this._getAccountByUsernameStmt = this.db.prepare(`
      SELECT username, password, nickname, user_id AS userId, role, coins
      FROM accounts
      WHERE username = ?
    `);
    this._getAccountByUserIdStmt = this.db.prepare(`
      SELECT username, password, nickname, user_id AS userId, role, coins
      FROM accounts
      WHERE user_id = ?
      LIMIT 1
    `);

    this._adjustCoinsStmt = this.db.prepare(`
      UPDATE accounts
      SET coins = coins + @delta
      WHERE user_id = @userId AND coins + @delta >= 0
    `);

    this._getCoinsStmt = this.db.prepare(`
      SELECT coins FROM accounts WHERE user_id = ? LIMIT 1
    `);

    this._getNicknameCountStmt = this.db.prepare(`
      SELECT COUNT(1) AS count
      FROM accounts
      WHERE nickname = ?
    `);

    this._insertSessionStmt = this.db.prepare(`
      INSERT INTO sessions (token, user_id, name, type, role, created_at)
      VALUES (@token, @userId, @name, @type, @role, @createdAt)
    `);

    this._deleteSessionByTokenStmt = this.db.prepare('DELETE FROM sessions WHERE token = ?');
    this._deleteSessionByUserIdStmt = this.db.prepare('DELETE FROM sessions WHERE user_id = ?');

    this._getSessionByTokenStmt = this.db.prepare(`
      SELECT token, user_id AS userId, name, type, role, created_at AS createdAt
      FROM sessions
      WHERE token = ?
    `);

    this._getSessionByUserIdStmt = this.db.prepare(`
      SELECT token, user_id AS userId, name, type, role, created_at AS createdAt
      FROM sessions
      WHERE user_id = ?
      LIMIT 1
    `);

    this._insertMessageStmt = this.db.prepare(`
      INSERT INTO chat_messages (id, user_id, name, message, timestamp, sender_type, pet_id, owner_user_id)
      VALUES (@id, @userId, @name, @message, @timestamp, @senderType, @petId, @ownerUserId)
    `);

    this._deleteOldMessagesStmt = this.db.prepare(`
      DELETE FROM chat_messages
      WHERE id IN (
        SELECT id
        FROM chat_messages
        ORDER BY timestamp DESC
        LIMIT -1 OFFSET ?
      )
    `);

    this._recentMessagesStmt = this.db.prepare(`
      SELECT
        id,
        user_id AS userId,
        name,
        message,
        timestamp,
        sender_type AS senderType,
        pet_id AS petId,
        owner_user_id AS ownerUserId
      FROM chat_messages
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    this._upsertLeaderboardStmt = this.db.prepare(`
      INSERT INTO leaderboard (name, wins)
      VALUES (?, 1)
      ON CONFLICT(name) DO UPDATE SET wins = wins + 1
    `);

    this._loadLeaderboardStmt = this.db.prepare(`
      SELECT name, wins
      FROM leaderboard
    `);

    this._insertPetStmt = this.db.prepare(`
      INSERT INTO pets (
        id,
        owner_user_id,
        pet_code,
        pet_type,
        pet_nickname,
        chat_visibility,
        control_mode,
        heartbeat_enabled,
        heartbeat_frequency,
        public_speech_enabled,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @ownerUserId,
        @petCode,
        @petType,
        @petNickname,
        @chatVisibility,
        @controlMode,
        @heartbeatEnabled,
        @heartbeatFrequency,
        @publicSpeechEnabled,
        @createdAt,
        @updatedAt
      )
    `);

    this._getPetByOwnerStmt = this.db.prepare(`
      SELECT
        id,
        owner_user_id AS ownerUserId,
        pet_code AS petCode,
        pet_type AS petType,
        pet_nickname AS petNickname,
        chat_visibility AS chatVisibility,
        control_mode AS controlMode,
        heartbeat_enabled AS heartbeatEnabled,
        heartbeat_frequency AS heartbeatFrequency,
        public_speech_enabled AS publicSpeechEnabled,
        last_agent_heartbeat_at AS lastAgentHeartbeatAt,
        last_agent_action_at AS lastAgentActionAt,
        last_public_speech_at AS lastPublicSpeechAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM pets
      WHERE owner_user_id = ?
      LIMIT 1
    `);

    this._getPetByIdStmt = this.db.prepare(`
      SELECT
        id,
        owner_user_id AS ownerUserId,
        pet_code AS petCode,
        pet_type AS petType,
        pet_nickname AS petNickname,
        chat_visibility AS chatVisibility,
        control_mode AS controlMode,
        heartbeat_enabled AS heartbeatEnabled,
        heartbeat_frequency AS heartbeatFrequency,
        public_speech_enabled AS publicSpeechEnabled,
        last_agent_heartbeat_at AS lastAgentHeartbeatAt,
        last_agent_action_at AS lastAgentActionAt,
        last_public_speech_at AS lastPublicSpeechAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM pets
      WHERE id = ?
      LIMIT 1
    `);

    this._updatePetSettingsStmt = this.db.prepare(`
      UPDATE pets
      SET
        pet_nickname = @petNickname,
        chat_visibility = @chatVisibility,
        control_mode = @controlMode,
        heartbeat_enabled = @heartbeatEnabled,
        heartbeat_frequency = @heartbeatFrequency,
        public_speech_enabled = @publicSpeechEnabled,
        updated_at = @updatedAt
      WHERE id = @petId
    `);

    this._updatePetAgentHeartbeatStmt = this.db.prepare(`
      UPDATE pets
      SET last_agent_heartbeat_at = ?, updated_at = ?
      WHERE id = ?
    `);

    this._updatePetAgentActionStmt = this.db.prepare(`
      UPDATE pets
      SET
        last_agent_action_at = ?,
        last_public_speech_at = CASE WHEN ? THEN ? ELSE last_public_speech_at END,
        updated_at = ?
      WHERE id = ?
    `);

    this._updatePetControlModeStmt = this.db.prepare(`
      UPDATE pets
      SET control_mode = ?, updated_at = ?
      WHERE id = ?
    `);

    this._updatePetTypeByOwnerStmt = this.db.prepare(`
      UPDATE pets
      SET pet_type = ?, updated_at = ?
      WHERE owner_user_id = ?
    `);

    this._upsertSettingStmt = this.db.prepare(`
      INSERT INTO system_settings (key, value, updated_at, updated_by)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    `);

    this._getAllSettingsStmt = this.db.prepare(`
      SELECT key, value, updated_at AS updatedAt, updated_by AS updatedBy
      FROM system_settings
      ORDER BY key ASC
    `);

    this._insertAuditLogStmt = this.db.prepare(`
      INSERT INTO admin_audit_logs (id, admin_user_id, action, detail, created_at)
      VALUES (@id, @adminUserId, @action, @detail, @createdAt)
    `);

    this._listAccountsStmt = this.db.prepare(`
      SELECT user_id AS userId, username, nickname, role, coins
      FROM accounts
      ORDER BY rowid DESC
      LIMIT ?
    `);

    this._updateAccountRoleStmt = this.db.prepare(`
      UPDATE accounts
      SET role = ?
      WHERE user_id = ?
    `);

    this._insertBindingStmt = this.db.prepare(`
      INSERT INTO agent_bindings (
        id,
        pet_id,
        owner_user_id,
        agent_id,
        status,
        last_seen_at,
        client_name,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @petId,
        @ownerUserId,
        @agentId,
        @status,
        @lastSeenAt,
        @clientName,
        @createdAt,
        @updatedAt
      )
      ON CONFLICT(pet_id) DO UPDATE SET
        owner_user_id = excluded.owner_user_id,
        agent_id = excluded.agent_id,
        status = excluded.status,
        last_seen_at = excluded.last_seen_at,
        client_name = excluded.client_name,
        updated_at = excluded.updated_at
    `);

    this._getBindingByPetIdStmt = this.db.prepare(`
      SELECT
        id,
        pet_id AS petId,
        owner_user_id AS ownerUserId,
        agent_id AS agentId,
        status,
        last_seen_at AS lastSeenAt,
        client_name AS clientName,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM agent_bindings
      WHERE pet_id = ?
      LIMIT 1
    `);

    this._updateBindingHeartbeatStmt = this.db.prepare(`
      UPDATE agent_bindings
      SET last_seen_at = ?, updated_at = ?
      WHERE pet_id = ? AND status = 'active'
    `);

    this._revokeBindingByPetStmt = this.db.prepare(`
      UPDATE agent_bindings
      SET status = 'revoked', updated_at = ?
      WHERE pet_id = ?
    `);

    this._insertInviteStmt = this.db.prepare(`
      INSERT INTO agent_invites (id, owner_user_id, pet_id, invite_code_hash, expires_at, max_uses, used_count, created_at)
      VALUES (@id, @ownerUserId, @petId, @inviteCodeHash, @expiresAt, @maxUses, @usedCount, @createdAt)
    `);

    this._findInviteByHashStmt = this.db.prepare(`
      SELECT
        id,
        owner_user_id AS ownerUserId,
        pet_id AS petId,
        invite_code_hash AS inviteCodeHash,
        expires_at AS expiresAt,
        max_uses AS maxUses,
        used_count AS usedCount,
        created_at AS createdAt
      FROM agent_invites
      WHERE invite_code_hash = ?
      LIMIT 1
    `);

    this._incrementInviteUseStmt = this.db.prepare(`
      UPDATE agent_invites
      SET used_count = used_count + 1
      WHERE id = ?
    `);

    this._insertAgentTokenStmt = this.db.prepare(`
      INSERT INTO agent_tokens (token, owner_user_id, pet_id, agent_id, expires_at, created_at)
      VALUES (@token, @ownerUserId, @petId, @agentId, @expiresAt, @createdAt)
    `);

    this._getAgentTokenStmt = this.db.prepare(`
      SELECT
        token,
        owner_user_id AS ownerUserId,
        pet_id AS petId,
        agent_id AS agentId,
        expires_at AS expiresAt,
        created_at AS createdAt
      FROM agent_tokens
      WHERE token = ?
      LIMIT 1
    `);

    this._insertThreadStmt = this.db.prepare(`
      INSERT INTO private_threads (id, owner_user_id, pet_id, binding_id, last_message_at)
      VALUES (@id, @ownerUserId, @petId, @bindingId, @lastMessageAt)
    `);

    this._findThreadByOwnerPetStmt = this.db.prepare(`
      SELECT
        id,
        owner_user_id AS ownerUserId,
        pet_id AS petId,
        binding_id AS bindingId,
        last_message_at AS lastMessageAt
      FROM private_threads
      WHERE owner_user_id = ? AND pet_id = ?
      LIMIT 1
    `);

    this._getThreadByIdStmt = this.db.prepare(`
      SELECT
        id,
        owner_user_id AS ownerUserId,
        pet_id AS petId,
        binding_id AS bindingId,
        last_message_at AS lastMessageAt
      FROM private_threads
      WHERE id = ?
      LIMIT 1
    `);

    this._insertPrivateMessageStmt = this.db.prepare(`
      INSERT INTO private_messages (id, thread_id, sender_type, sender_user_id, content, created_at)
      VALUES (@id, @threadId, @senderType, @senderUserId, @content, @createdAt)
    `);

    this._updateThreadLastMessageStmt = this.db.prepare(`
      UPDATE private_threads
      SET last_message_at = ?
      WHERE id = ?
    `);

    this._listThreadMessagesStmt = this.db.prepare(`
      SELECT
        id,
        thread_id AS threadId,
        sender_type AS senderType,
        sender_user_id AS senderUserId,
        content,
        created_at AS createdAt
      FROM private_messages
      WHERE thread_id = ? AND created_at > ?
      ORDER BY created_at ASC
      LIMIT ?
    `);

    this._insertCombatLineStmt = this.db.prepare(`
      INSERT OR IGNORE INTO pet_combat_lines (id, pet_type, line_type, text, created_at)
      VALUES (@id, @petType, @lineType, @text, @createdAt)
    `);
    this._listCombatLinesStmt = this.db.prepare(`
      SELECT pet_type AS petType, line_type AS lineType, text
      FROM pet_combat_lines
      ORDER BY pet_type ASC, line_type ASC, rowid ASC
    `);
    this._countCombatLinesStmt = this.db.prepare(`
      SELECT COUNT(1) AS count
      FROM pet_combat_lines
    `);
    this._insertNpcDialogueStmt = this.db.prepare(`
      INSERT OR IGNORE INTO npc_dialogues (id, npc_id, scene, text, created_at)
      VALUES (@id, @npcId, @scene, @text, @createdAt)
    `);
    this._listNpcDialoguesStmt = this.db.prepare(`
      SELECT npc_id AS npcId, scene, text
      FROM npc_dialogues
      ORDER BY npc_id ASC, scene ASC, rowid ASC
    `);
    this._countNpcDialoguesStmt = this.db.prepare(`
      SELECT COUNT(1) AS count
      FROM npc_dialogues
    `);

    this._insertFightMatchStmt = this.db.prepare(`
      INSERT OR REPLACE INTO fight_matches (
        id, fighter_a_id, fighter_a_name, fighter_b_id, fighter_b_name,
        winner_id, winner_name, loser_id, loser_name, duration_ms, seed,
        summary_json, created_at, finished_at
      )
      VALUES (
        @id, @fighterAId, @fighterAName, @fighterBId, @fighterBName,
        @winnerId, @winnerName, @loserId, @loserName, @durationMs, @seed,
        @summaryJson, @createdAt, @finishedAt
      )
    `);
    this._insertFightEventStmt = this.db.prepare(`
      INSERT OR IGNORE INTO fight_events (id, match_id, frame, type, payload_json, created_at)
      VALUES (@id, @matchId, @frame, @type, @payloadJson, @createdAt)
    `);
    this._getFightMatchStmt = this.db.prepare(`
      SELECT
        id,
        fighter_a_id AS fighterAId,
        fighter_a_name AS fighterAName,
        fighter_b_id AS fighterBId,
        fighter_b_name AS fighterBName,
        winner_id AS winnerId,
        winner_name AS winnerName,
        loser_id AS loserId,
        loser_name AS loserName,
        duration_ms AS durationMs,
        seed,
        summary_json AS summaryJson,
        created_at AS createdAt,
        finished_at AS finishedAt
      FROM fight_matches
      WHERE id = ?
      LIMIT 1
    `);
    this._listFightEventsStmt = this.db.prepare(`
      SELECT id, match_id AS matchId, frame, type, payload_json AS payloadJson, created_at AS createdAt
      FROM fight_events
      WHERE match_id = ?
      ORDER BY frame ASC, created_at ASC
      LIMIT ?
    `);

    this._seedDefaultCombatLines();
    this._seedDefaultNpcDialogues();
  }

  _seedDefaultCombatLines() {
    const countRow = this._countCombatLinesStmt.get();
    if ((countRow?.count || 0) > 0) return;
    const now = Date.now();
    const tx = this.db.transaction(() => {
      for (const [petType, groups] of Object.entries(DEFAULT_COMBAT_LINES)) {
        for (const [lineType, texts] of Object.entries(groups)) {
          for (const text of texts) {
            const id = `cl_${Math.random().toString(36).slice(2, 12)}`;
            this._insertCombatLineStmt.run({ id, petType, lineType, text, createdAt: now });
          }
        }
      }
    });
    tx();
  }

  _seedDefaultNpcDialogues() {
    const countRow = this._countNpcDialoguesStmt.get();
    if ((countRow?.count || 0) > 0) return;
    const now = Date.now();
    const tx = this.db.transaction(() => {
      for (const [npcId, scenes] of Object.entries(DEFAULT_NPC_DIALOGUES)) {
        for (const [scene, texts] of Object.entries(scenes)) {
          for (const text of texts) {
            const id = `nd_${Math.random().toString(36).slice(2, 12)}`;
            this._insertNpcDialogueStmt.run({ id, npcId, scene, text, createdAt: now });
          }
        }
      }
    });
    tx();
  }

  createAccount(account) {
    this._insertAccountStmt.run({
      ...account,
      coins: account.coins ?? CONFIG.ECONOMY.INITIAL_COINS,
    });
  }

  getAccountByUsername(username) {
    return this._getAccountByUsernameStmt.get(username) || null;
  }

  getAccountByUserId(userId) {
    return this._getAccountByUserIdStmt.get(userId) || null;
  }

  /**
   * @returns {{ success: boolean, coins?: number, code?: string }}
   */
  adjustCoinsByUserId(userId, delta) {
    if (!userId || typeof delta !== 'number' || !Number.isFinite(delta) || Math.round(delta) !== delta) {
      return { success: false, code: 'INVALID_ARGS' };
    }
    const info = this._adjustCoinsStmt.run({ userId, delta });
    if (info.changes === 0) {
      return { success: false, code: delta < 0 ? 'INSUFFICIENT_COINS' : 'UPDATE_FAILED' };
    }
    const row = this._getCoinsStmt.get(userId);
    return { success: true, coins: row?.coins ?? 0 };
  }

  getCoinsByUserId(userId) {
    const row = this._getCoinsStmt.get(userId);
    return row?.coins ?? null;
  }

  updateAccountPassword(username, password) {
    this.db.prepare(`
      UPDATE accounts
      SET password = ?
      WHERE username = ?
    `).run(password, username);
  }

  updateAccountPasswordByUserId(userId, password) {
    this.db.prepare(`
      UPDATE accounts
      SET password = ?
      WHERE user_id = ?
    `).run(password, userId);
  }

  isNicknameTaken(nickname) {
    const row = this._getNicknameCountStmt.get(nickname);
    return row.count > 0;
  }

  saveSession(session) {
    this._insertSessionStmt.run(session);
  }

  getSessionByToken(token) {
    return this._getSessionByTokenStmt.get(token) || null;
  }

  getSessionByUserId(userId) {
    return this._getSessionByUserIdStmt.get(userId) || null;
  }

  removeSessionByToken(token) {
    this._deleteSessionByTokenStmt.run(token);
  }

  removeSessionByUserId(userId) {
    this._deleteSessionByUserIdStmt.run(userId);
  }

  saveMessage(message) {
    this._insertMessageStmt.run({
      ...message,
      senderType: message.senderType || 'user',
      petId: message.petId || null,
      ownerUserId: message.ownerUserId || null,
    });
  }

  getRecentMessages(limit) {
    return this._recentMessagesStmt.all(limit).reverse();
  }

  trimMessages(limit) {
    this._deleteOldMessagesStmt.run(limit);
  }

  addWin(name) {
    this._upsertLeaderboardStmt.run(name);
  }

  getLeaderboard() {
    return this._loadLeaderboardStmt.all();
  }

  createPetForOwner({ id, ownerUserId, petType, petNickname }) {
    const now = Date.now();
    let petCode = generatePetCode();
    while (this.db.prepare('SELECT 1 FROM pets WHERE pet_code = ? LIMIT 1').get(petCode)) {
      petCode = generatePetCode();
    }
    this._insertPetStmt.run({
      id,
      ownerUserId,
      petCode,
      petType,
      petNickname,
      chatVisibility: 'public',
      controlMode: 'follow',
      heartbeatEnabled: 0,
      heartbeatFrequency: 'standard',
      publicSpeechEnabled: 1,
      createdAt: now,
      updatedAt: now,
    });
    return this.getPetByOwnerUserId(ownerUserId);
  }

  getPetByOwnerUserId(ownerUserId) {
    return this._getPetByOwnerStmt.get(ownerUserId) || null;
  }

  getPetById(petId) {
    return this._getPetByIdStmt.get(petId) || null;
  }

  updatePetSettings(petId, petNicknameOrPatch, chatVisibility = 'public') {
    const current = this.getPetById(petId);
    if (!current) return null;
    const patch = typeof petNicknameOrPatch === 'object' && petNicknameOrPatch !== null
      ? petNicknameOrPatch
      : { petNickname: petNicknameOrPatch, chatVisibility };
    const next = {
      petId,
      petNickname: typeof patch.petNickname === 'string' ? patch.petNickname : current.petNickname,
      chatVisibility: patch.chatVisibility || current.chatVisibility || 'public',
      controlMode: patch.controlMode || current.controlMode || 'follow',
      heartbeatEnabled: patch.heartbeatEnabled === true || patch.heartbeatEnabled === 1 ? 1 : 0,
      heartbeatFrequency: patch.heartbeatFrequency || current.heartbeatFrequency || 'standard',
      publicSpeechEnabled: patch.publicSpeechEnabled === false || patch.publicSpeechEnabled === 0 ? 0 : 1,
      updatedAt: Date.now(),
    };
    this._updatePetSettingsStmt.run(next);
    return this.getPetById(petId);
  }

  updatePetAgentHeartbeat(petId, now = Date.now()) {
    this._updatePetAgentHeartbeatStmt.run(now, now, petId);
    return this.getPetById(petId);
  }

  updatePetAgentAction(petId, { publicSpeech = false, now = Date.now() } = {}) {
    this._updatePetAgentActionStmt.run(now, publicSpeech ? 1 : 0, now, now, petId);
    return this.getPetById(petId);
  }

  updatePetControlMode(petId, controlMode) {
    this._updatePetControlModeStmt.run(controlMode, Date.now(), petId);
    return this.getPetById(petId);
  }

  /**
   * 更新主人的宠物类型（与登录页选择一致）
   * @param {string} ownerUserId
   * @param {string} petType
   */
  updatePetTypeByOwnerUserId(ownerUserId, petType) {
    const r = this._updatePetTypeByOwnerStmt.run(petType, Date.now(), ownerUserId);
    return r.changes > 0;
  }

  upsertSystemSetting({ key, value, updatedBy }) {
    this._upsertSettingStmt.run(key, value, Date.now(), updatedBy);
  }

  getSystemSettings() {
    return this._getAllSettingsStmt.all();
  }

  addAdminAuditLog(log) {
    this._insertAuditLogStmt.run(log);
  }

  listAccounts(limit = 100) {
    return this._listAccountsStmt.all(limit);
  }

  updateAccountRole(userId, role) {
    this._updateAccountRoleStmt.run(role, userId);
  }

  listCombatLines() {
    const rows = this._listCombatLinesStmt.all();
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.petType]) {
        grouped[row.petType] = { attack: [], counter: [] };
      }
      if (row.lineType === 'attack' || row.lineType === 'counter') {
        grouped[row.petType][row.lineType].push(row.text);
      }
    }
    return grouped;
  }

  listNpcDialogues(npcId = null, scene = null) {
    const rows = this._listNpcDialoguesStmt.all();
    return rows
      .filter((row) => (npcId ? row.npcId === npcId : true))
      .filter((row) => (scene ? row.scene === scene : true))
      .map((row) => row.text);
  }

  recordFightMatch(match) {
    this._insertFightMatchStmt.run({
      id: match.id,
      fighterAId: match.fighterAId,
      fighterAName: match.fighterAName,
      fighterBId: match.fighterBId,
      fighterBName: match.fighterBName,
      winnerId: match.winnerId || null,
      winnerName: match.winnerName || null,
      loserId: match.loserId || null,
      loserName: match.loserName || null,
      durationMs: match.durationMs || 0,
      seed: match.seed || 0,
      summaryJson: JSON.stringify(match.summary || {}),
      createdAt: match.createdAt || Date.now(),
      finishedAt: match.finishedAt || null,
    });
  }

  recordFightEvent(event) {
    if (!event?.id || !event?.matchId) return;
    this._insertFightEventStmt.run({
      id: event.id,
      matchId: event.matchId,
      frame: event.frame || 0,
      type: event.type,
      payloadJson: JSON.stringify(event.payload || {}),
      createdAt: event.timestamp || Date.now(),
    });
  }

  getFightMatch(matchId) {
    const row = this._getFightMatchStmt.get(matchId);
    if (!row) return null;
    return {
      ...row,
      summary: JSON.parse(row.summaryJson || '{}'),
    };
  }

  listFightEvents(matchId, limit = 500) {
    return this._listFightEventsStmt.all(matchId, limit).map((row) => ({
      ...row,
      payload: JSON.parse(row.payloadJson || '{}'),
    }));
  }

  upsertAgentBinding(binding) {
    const now = Date.now();
    this._insertBindingStmt.run({
      ...binding,
      lastSeenAt: binding.lastSeenAt ?? null,
      clientName: binding.clientName ?? null,
      createdAt: binding.createdAt || now,
      updatedAt: binding.updatedAt || now,
    });
  }

  getAgentBindingByPetId(petId) {
    return this._getBindingByPetIdStmt.get(petId) || null;
  }

  updateAgentBindingHeartbeat(petId, now = Date.now()) {
    this._updateBindingHeartbeatStmt.run(now, now, petId);
    return this.getAgentBindingByPetId(petId);
  }

  revokeAgentBindingForPet(petId) {
    this._revokeBindingByPetStmt.run(Date.now(), petId);
    return this.getAgentBindingByPetId(petId);
  }

  createAgentInvite(invite) {
    this._insertInviteStmt.run(invite);
  }

  getAgentInviteByCodeHash(inviteCodeHash) {
    return this._findInviteByHashStmt.get(inviteCodeHash) || null;
  }

  consumeAgentInvite(inviteId) {
    this._incrementInviteUseStmt.run(inviteId);
  }

  createAgentToken(agentToken) {
    this._insertAgentTokenStmt.run(agentToken);
  }

  getAgentToken(token) {
    return this._getAgentTokenStmt.get(token) || null;
  }

  ensurePrivateThread(ownerUserId, petId) {
    const existing = this._findThreadByOwnerPetStmt.get(ownerUserId, petId);
    if (existing) return existing;
    const now = Date.now();
    const id = `thr_${Math.random().toString(36).slice(2, 10)}`;
    const binding = this.getAgentBindingByPetId(petId);
    this._insertThreadStmt.run({
      id,
      ownerUserId,
      petId,
      bindingId: binding?.id || null,
      lastMessageAt: now,
    });
    return this._getThreadByIdStmt.get(id);
  }

  getPrivateThreadById(threadId) {
    return this._getThreadByIdStmt.get(threadId) || null;
  }

  addPrivateMessage(message) {
    this._insertPrivateMessageStmt.run(message);
    this._updateThreadLastMessageStmt.run(message.createdAt, message.threadId);
  }

  getPrivateMessages(threadId, since = 0, limit = 100) {
    return this._listThreadMessagesStmt.all(threadId, since, limit);
  }
}
