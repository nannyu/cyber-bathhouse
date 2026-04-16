/**
 * 赛博澡堂 — 服务端入口
 *
 * Express + Socket.IO + MCP Server
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, isAbsolute } from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

import { CONFIG } from './config.js';
import { World } from './world/World.js';
import { AuthManager } from './api/auth.js';
import { createApiRoutes } from './api/routes.js';
import { initWebSocket } from './api/websocket.js';
import { createMcpServer, mountMcpServer } from './mcp/index.js';
import { Database } from './db/Database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── 实例化核心模块 ───────────────────────────────────
const databasePath = isAbsolute(CONFIG.DB_PATH)
  ? CONFIG.DB_PATH
  : resolve(__dirname, '..', CONFIG.DB_PATH);
const database = new Database(databasePath);

// ─── Bootstrap admin account ──────────────────────────
// 规则：默认用户名 `admin`，密码 `admin`。
// 仅在首次启动缺失时创建；如昵称被占用会自动追加后缀以通过唯一约束。
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const ADMIN_NICKNAME_BASE = process.env.ADMIN_NICKNAME || 'Admin';

function ensureUniqueNickname(base) {
  let nickname = base;
  let i = 1;
  while (database.isNicknameTaken(nickname)) {
    i += 1;
    nickname = `${base}_${i}`;
  }
  return nickname;
}

const existingAdmin = database.getAccountByUsername(ADMIN_USERNAME);
if (!existingAdmin) {
  const userId = `usr_${uuidv4().slice(0, 8)}`;
  const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, CONFIG.BCRYPT_ROUNDS);
  const nickname = ensureUniqueNickname(ADMIN_NICKNAME_BASE);

  database.createAccount({
    username: ADMIN_USERNAME,
    password: passwordHash,
    nickname,
    userId,
    role: 'admin',
  });

  // 创建一个默认宠物档案，保证管理员可正常进入世界并点击宠物界面
  const petId = `pet_${uuidv4().slice(0, 8)}`;
  database.createPetForOwner({
    id: petId,
    ownerUserId: userId,
    petType: CONFIG.PET_TYPES[0],
    petNickname: `${nickname}的宠物`,
  });
}

const world = new World(database);
const auth = new AuthManager(database);

// ─── Express 应用 ─────────────────────────────────────
const app = express();
// 如果部署在反向代理 (Nginx/Traefik/Cloudflare) 后面，Express 需要信任代理头
// 才能正确识别 req.protocol（从而生成 HTTPS endpoint）。
app.set('trust proxy', true);
app.use(cors());
app.use(express.json());

// ─── REST API ─────────────────────────────────────────
app.use('/api', createApiRoutes(world, auth));

// ─── MCP Server ───────────────────────────────────────
const mcpServer = createMcpServer(world, auth);
await mountMcpServer(app, mcpServer);

// ─── 静态文件（生产模式）──────────────────────────────
if (CONFIG.NODE_ENV === 'production') {
  const distPath = join(__dirname, '..', 'dist');
  app.use(express.static(distPath));

  // SPA fallback
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/mcp')) {
      res.sendFile(join(distPath, 'index.html'));
    }
  });
}

// ─── HTTP Server + Socket.IO ──────────────────────────
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// ─── WebSocket 初始化 ─────────────────────────────────
initWebSocket(io, world, auth);

// ─── 启动 ─────────────────────────────────────────────
httpServer.listen(CONFIG.PORT, () => {
  console.log('');
  console.log('  🏯 ═══════════════════════════════════════════');
  console.log('  ║                                             ║');
  console.log('  ║     赛博澡堂 Cyber Bathhouse               ║');
  console.log('  ║                                             ║');
  console.log('  ═══════════════════════════════════════════════');
  console.log('');
  console.log(`  🌐 Web:        http://localhost:${CONFIG.PORT}`);
  console.log(`  📡 REST API:   http://localhost:${CONFIG.PORT}/api`);
  console.log(`  🔌 MCP:        http://localhost:${CONFIG.PORT}/mcp`);
  console.log(`  🔗 WebSocket:  ws://localhost:${CONFIG.PORT}`);
  console.log('');
  console.log(`  📊 环境: ${CONFIG.NODE_ENV}`);
  console.log(`  👥 最大用户: ${CONFIG.MAX_USERS}`);
  console.log(`  ⏱  Tick 频率: ${CONFIG.TICK_RATE}Hz`);
  console.log('');
  console.log('  💡 Agent 接入:');
  console.log(`     claude mcp add cyber-bathhouse --transport http http://localhost:${CONFIG.PORT}/mcp`);
  console.log('');
});
