/**
 * 动作日志 — SQLite 持久化
 */

export class ActionLogger {
    /**
     * @param {import('better-sqlite3').Database} db - SQLite 数据库实例
     * @param {string} roomId
     */
    constructor(db, roomId) {
        this.db = db;
        this.roomId = roomId;
        this._ensureTable();
    }

    _ensureTable() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS action_logs_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        tick INTEGER NOT NULL,
        actor_id TEXT NOT NULL,
        actor_type TEXT NOT NULL,
        actions_submitted TEXT,
        actions_validated TEXT,
        actions_rejected TEXT,
        reason TEXT,
        world_effect TEXT,
        created_at INTEGER NOT NULL
      )
    `);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_action_logs_v2_room_tick ON action_logs_v2(room_id, tick)`);
    }

    /**
     * 记录一条动作日志
     * @param {Object} entry
     */
    log(entry) {
        const stmt = this.db.prepare(`
      INSERT INTO action_logs_v2 (room_id, tick, actor_id, actor_type, actions_submitted, actions_validated, actions_rejected, reason, world_effect, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(
            this.roomId,
            entry.tick ?? 0,
            entry.actorId ?? '',
            entry.actorType ?? 'unknown',
            JSON.stringify(entry.actionsSubmitted || []),
            JSON.stringify(entry.actionsValidated || []),
            JSON.stringify(entry.actionsRejected || []),
            entry.reason || null,
            entry.worldEffect ? JSON.stringify(entry.worldEffect) : null,
            Date.now(),
        );
    }

    /**
     * 查询日志
     * @param {Object} [options]
     * @param {number} [options.limit=50]
     * @param {number} [options.offset=0]
     * @returns {Array<Object>}
     */
    query({ limit = 50, offset = 0 } = {}) {
        const stmt = this.db.prepare(`
      SELECT * FROM action_logs_v2
      WHERE room_id = ?
      ORDER BY tick ASC, id ASC
      LIMIT ? OFFSET ?
    `);
        const rows = stmt.all(this.roomId, limit, offset);
        return rows.map(row => ({
            id: row.id,
            roomId: row.room_id,
            tick: row.tick,
            actorId: row.actor_id,
            actorType: row.actor_type,
            actionsSubmitted: JSON.parse(row.actions_submitted || '[]'),
            actionsValidated: JSON.parse(row.actions_validated || '[]'),
            actionsRejected: JSON.parse(row.actions_rejected || '[]'),
            reason: row.reason,
            worldEffect: row.world_effect ? JSON.parse(row.world_effect) : null,
            createdAt: row.created_at,
        }));
    }

    /**
     * 获取日志总数
     */
    count() {
        const row = this.db.prepare('SELECT COUNT(*) as cnt FROM action_logs_v2 WHERE room_id = ?').get(this.roomId);
        return row?.cnt || 0;
    }
}
