import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import bcrypt from 'bcryptjs';
import { Database } from '../server/db/Database.js';
import { World } from '../server/world/World.js';
import { FIGHT_PHASES } from '../server/combat/FightMatch.js';
import { CONFIG } from '../server/config.js';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyber-bathhouse-combat-'));
const db = new Database(path.join(tempDir, 'combat.sqlite'));
const pw = bcrypt.hashSync('smoke', 4);
const initial = CONFIG.ECONOMY.INITIAL_COINS;
db.createAccount({
  username: 'smoke_alpha', password: pw, nickname: 'Alpha', userId: 'usr_alpha', role: 'user', coins: initial,
});
db.createAccount({
  username: 'smoke_beta', password: pw, nickname: 'Beta', userId: 'usr_beta', role: 'user', coins: initial,
});

const world = new World(db);
const broadcastEvents = [];

world.setBroadcast((event, data) => {
  broadcastEvents.push({ event, data });
});

world.addUser({ id: 'usr_alpha', name: 'Alpha', type: 'agent', petType: 'cyber_cat' });
world.addUser({ id: 'usr_beta', name: 'Beta', type: 'agent', petType: 'mech_dog' });

world.processCombatPlan('usr_alpha', {
  style: 'rushdown',
  ultimatePolicy: 'confirm_only',
  expiresAt: Date.now() + 10000,
});
world.processCombatPlan('usr_beta', {
  style: 'footsies',
  ultimatePolicy: 'reversal_when_low',
  expiresAt: Date.now() + 10000,
});

const start = world.processFight('usr_alpha', 'Beta');
assert.equal(start.success, true);

// 跳过 staging（walk_in / countdown），直接进入 ACTIVE 进行算法测试
const _smokeFight = [...world.fightManager._fights.values()][0];
_smokeFight.setPhase(FIGHT_PHASES.ACTIVE);
_smokeFight._arenaPositioned = true;
world.getUser('usr_alpha').state = 'fighting';
world.getUser('usr_beta').state = 'fighting';

const state = world.getCombatState('usr_alpha');
assert.equal(state.success, true);
assert.equal(state.match.fighters.length, 2);

const action = world.processCombatAction('usr_alpha', {
  intent: 'poke',
  skill_id: 'light_punch',
});
assert.equal(action.success, true);
assert.equal(action.attackerSkillId, 'light_punch');
assert.equal(typeof action.yourRage, 'number');

const eventCount = db.db.prepare('SELECT COUNT(1) AS count FROM fight_events').get().count;
assert.ok(eventCount > 0);

const beta = world.getUser('usr_beta');
beta.hp = 6;
const closeFight = [...world.fightManager._fights.values()][0];
closeFight.getFighter('usr_alpha').x = 390;
closeFight.getFighter('usr_beta').x = 430;
closeFight.getFighter('usr_beta').hp = 6;
world.getUser('usr_alpha').x = 390;
world.getUser('usr_alpha').targetX = 390;
world.getUser('usr_beta').x = 430;
world.getUser('usr_beta').targetX = 430;
let finalResult = null;
for (let i = 0; i < 300; i += 1) {
  world.tick(50);
  const activeFight = [...world.fightManager._fights.values()][0];
  if (activeFight) {
    const alphaFighter = activeFight.getFighter('usr_alpha');
    alphaFighter.cooldowns = {};
  }
  finalResult = world.processCombatAction('usr_alpha', {
    intent: 'whiff_punish',
    skill_id: 'heavy_strike',
  });
  if (finalResult.finished || world.getUser('usr_alpha')?.lastFightResult?.finished) break;
}
const settled = finalResult.finished ? finalResult : world.getUser('usr_alpha')?.lastFightResult;
assert.equal(settled.finished, true);
assert.equal(settled.winnerId, 'usr_alpha');

const matchCount = db.db.prepare('SELECT COUNT(1) AS count FROM fight_matches').get().count;
assert.equal(matchCount, 1);

const replay = world.getCombatReplay(settled.fightId);
assert.equal(replay.success, true);
assert.ok(replay.events.length > 0);
assert.ok(broadcastEvents.some((entry) => entry.event === 'fight:ended'));

console.log(JSON.stringify({
  ok: true,
  fightId: settled.fightId,
  winnerId: settled.winnerId,
  events: replay.events.length,
}));
