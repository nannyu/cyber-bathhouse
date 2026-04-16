import fs from 'fs';
import path from 'path';
import DatabaseDriver from 'better-sqlite3';

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
];

export class Database {
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
    this._ensureColumn('sessions', 'role', "ALTER TABLE sessions ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
    this._ensureColumn('pets', 'chat_visibility', "ALTER TABLE pets ADD COLUMN chat_visibility TEXT NOT NULL DEFAULT 'public'");
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
    `);
  }

  _prepareStatements() {
    this._insertAccountStmt = this.db.prepare(`
      INSERT INTO accounts (username, password, nickname, user_id, role)
      VALUES (@username, @password, @nickname, @userId, @role)
    `);

    this._getAccountByUsernameStmt = this.db.prepare(`
      SELECT username, password, nickname, user_id AS userId, role
      FROM accounts
      WHERE username = ?
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
      INSERT INTO chat_messages (id, user_id, name, message, timestamp)
      VALUES (@id, @userId, @name, @message, @timestamp)
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
      SELECT id, user_id AS userId, name, message, timestamp
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
      INSERT INTO pets (id, owner_user_id, pet_code, pet_type, pet_nickname, chat_visibility, created_at, updated_at)
      VALUES (@id, @ownerUserId, @petCode, @petType, @petNickname, @chatVisibility, @createdAt, @updatedAt)
    `);

    this._getPetByOwnerStmt = this.db.prepare(`
      SELECT
        id,
        owner_user_id AS ownerUserId,
        pet_code AS petCode,
        pet_type AS petType,
        pet_nickname AS petNickname,
        chat_visibility AS chatVisibility,
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
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM pets
      WHERE id = ?
      LIMIT 1
    `);

    this._updatePetSettingsStmt = this.db.prepare(`
      UPDATE pets
      SET pet_nickname = ?, chat_visibility = ?, updated_at = ?
      WHERE id = ?
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
      SELECT user_id AS userId, username, nickname, role
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
      INSERT INTO agent_bindings (id, pet_id, owner_user_id, agent_id, status, created_at, updated_at)
      VALUES (@id, @petId, @ownerUserId, @agentId, @status, @createdAt, @updatedAt)
      ON CONFLICT(pet_id) DO UPDATE SET
        owner_user_id = excluded.owner_user_id,
        agent_id = excluded.agent_id,
        status = excluded.status,
        updated_at = excluded.updated_at
    `);

    this._getBindingByPetIdStmt = this.db.prepare(`
      SELECT
        id,
        pet_id AS petId,
        owner_user_id AS ownerUserId,
        agent_id AS agentId,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM agent_bindings
      WHERE pet_id = ?
      LIMIT 1
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
  }

  createAccount(account) {
    this._insertAccountStmt.run(account);
  }

  getAccountByUsername(username) {
    return this._getAccountByUsernameStmt.get(username) || null;
  }

  updateAccountPassword(username, password) {
    this.db.prepare(`
      UPDATE accounts
      SET password = ?
      WHERE username = ?
    `).run(password, username);
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
    this._insertMessageStmt.run(message);
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

  updatePetSettings(petId, petNickname, chatVisibility = 'public') {
    this._updatePetSettingsStmt.run(petNickname, chatVisibility, Date.now(), petId);
    return this.getPetById(petId);
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

  upsertAgentBinding(binding) {
    this._insertBindingStmt.run(binding);
  }

  getAgentBindingByPetId(petId) {
    return this._getBindingByPetIdStmt.get(petId) || null;
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
