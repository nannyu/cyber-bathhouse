/**
 * 金币 DB 与 adjustCoins 防负币冒烟
 */
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import bcrypt from 'bcryptjs';
import { Database } from '../server/db/Database.js';
import { CONFIG } from '../server/config.js';

const dir = mkdtempSync(join(tmpdir(), 'bh-econ-'));
const dbPath = join(dir, 'eco.sqlite');
let db;
try {
  db = new Database(dbPath);
  const uid = 'usr_eco_test';
  db.createAccount({
    username: 'eco_u1',
    password: bcrypt.hashSync('secret', 4),
    nickname: 'EcoNick',
    userId: uid,
    role: 'user',
    coins: CONFIG.ECONOMY.INITIAL_COINS,
  });

  const c0 = db.getCoinsByUserId(uid);
  if (c0 !== CONFIG.ECONOMY.INITIAL_COINS) {
    throw new Error(`expected initial ${CONFIG.ECONOMY.INITIAL_COINS}, got ${c0}`);
  }

  const r1 = db.adjustCoinsByUserId(uid, -100);
  if (!r1.success || r1.coins !== c0 - 100) throw new Error(`deduct fail ${JSON.stringify(r1)}`);

  const r2 = db.adjustCoinsByUserId(uid, -999999);
  if (r2.success) throw new Error('expected insufficient coins');

  const r3 = db.adjustCoinsByUserId(uid, 50);
  if (!r3.success || r3.coins !== r1.coins + 50) throw new Error(`credit fail ${JSON.stringify(r3)}`);

  console.log(JSON.stringify({ ok: true, coins: r3.coins }));
} finally {
  try {
    db?.db?.close();
  } catch { /* ignore */ }
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}
