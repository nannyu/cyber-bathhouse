/**
 * Agent 接管宠物冒烟测试
 */
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import bcrypt from 'bcryptjs';
import { Database } from '../server/db/Database.js';
import { World } from '../server/world/World.js';
import { CONFIG } from '../server/config.js';

function assertOk(value, label) {
  if (!value?.success) {
    throw new Error(`${label} failed: ${JSON.stringify(value)}`);
  }
  return value;
}

function assertFail(value, code, label) {
  if (value?.success || value?.code !== code) {
    throw new Error(`${label} expected ${code}, got ${JSON.stringify(value)}`);
  }
  return value;
}

const dir = mkdtempSync(join(tmpdir(), 'bh-agent-pet-'));
const dbPath = join(dir, 'agent-pet.sqlite');
let db;

try {
  db = new Database(dbPath);
  const ownerUserId = 'usr_agent_pet_owner';
  db.createAccount({
    username: 'pet_owner',
    password: bcrypt.hashSync('secret123', 4),
    nickname: 'Owner',
    userId: ownerUserId,
    role: 'user',
    coins: CONFIG.ECONOMY.INITIAL_COINS,
  });

  const pet = db.createPetForOwner({
    id: 'pet_agent_smoke',
    ownerUserId,
    petType: 'cyber_cat',
    petNickname: '泡泡',
  });

  if (pet.controlMode !== 'follow') {
    throw new Error(`expected default controlMode follow, got ${pet.controlMode}`);
  }
  if (pet.heartbeatEnabled !== 0) {
    throw new Error(`expected heartbeat disabled by default, got ${pet.heartbeatEnabled}`);
  }

  db.upsertAgentBinding({
    id: 'bind_agent_pet_smoke',
    petId: pet.id,
    ownerUserId,
    agentId: 'agent_smoke',
    status: 'active',
    clientName: 'Smoke Agent',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  db.createAgentToken({
    token: 'agt_agent_pet_smoke',
    ownerUserId,
    petId: pet.id,
    agentId: 'agent_smoke',
    expiresAt: Date.now() + 60000,
    createdAt: Date.now(),
  });

  const world = new World(db);
  const joined = assertOk(world.addUser({
    id: ownerUserId,
    name: 'Owner',
    type: 'browser',
    petType: pet.petType,
  }), 'join owner');
  world.applyPetProfileToUser(joined.user, db.getPetByOwnerUserId(ownerUserId));

  db.updatePetSettings(pet.id, {
    petNickname: '泡泡',
    chatVisibility: 'public',
    controlMode: 'agent_controlled',
    heartbeatEnabled: true,
    heartbeatFrequency: 'active',
    publicSpeechEnabled: true,
  });
  world.applyPetProfileToUser(joined.user, db.getPetByOwnerUserId(ownerUserId));

  const token = db.getAgentToken('agt_agent_pet_smoke');
  const heartbeat = assertOk(world.processAgentPetHeartbeat(token, {
    status: 'online',
    mood: 'curious',
    last_action: 'joined_test',
  }), 'heartbeat');
  if (heartbeat.activityDue !== true) {
    throw new Error(`expected first heartbeat activityDue true, got ${JSON.stringify(heartbeat)}`);
  }

  const move = assertOk(world.processAgentPetMove(token, { x: 222, y: 333 }), 'agent pet move');
  if (move.to.x !== 222 || move.to.y !== 333) {
    throw new Error(`unexpected move target ${JSON.stringify(move)}`);
  }

  const say = assertOk(world.processAgentPetSay(token, { message: '我替主人巡逻一下。' }), 'agent pet say');
  if (!say.messageId) {
    throw new Error(`expected message id from pet say, got ${JSON.stringify(say)}`);
  }
  const recent = db.getRecentMessages(1)[0];
  if (recent.name !== '泡泡' || recent.senderType !== 'pet') {
    throw new Error(`expected pet-attributed chat, got ${JSON.stringify(recent)}`);
  }

  db.updatePetSettings(pet.id, {
    petNickname: '泡泡',
    chatVisibility: 'public',
    controlMode: 'agent_controlled',
    heartbeatEnabled: true,
    heartbeatFrequency: 'active',
    publicSpeechEnabled: false,
  });
  world.applyPetProfileToUser(joined.user, db.getPetByOwnerUserId(ownerUserId));
  assertFail(
    world.processAgentPetSay(token, { message: '这句不该公开。' }),
    'PUBLIC_SPEECH_DISABLED',
    'public speech disabled',
  );

  const recalled = assertOk(world.processPetRecall(ownerUserId, { follow: true }), 'owner recall');
  if (recalled.pet.controlMode !== 'follow') {
    throw new Error(`expected recall to set follow, got ${JSON.stringify(recalled)}`);
  }
  assertFail(
    world.processAgentPetMove(token, { x: 300, y: 300 }),
    'AGENT_CONTROL_DISABLED',
    'move after recall',
  );

  db.revokeAgentBindingForPet(pet.id);
  assertFail(
    world.processAgentPetHeartbeat(token, { status: 'online' }),
    'BINDING_REVOKED',
    'heartbeat after revoke',
  );

  console.log(JSON.stringify({
    ok: true,
    petId: pet.id,
    messageId: say.messageId,
    recalledMode: recalled.pet.controlMode,
  }));
} finally {
  try {
    db?.db?.close();
  } catch { /* ignore */ }
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}
