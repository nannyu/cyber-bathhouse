/**
 * MCP Server — 赛博澡堂 Agent 工具集
 *
 * 提供 bathhouse_* 系列工具，供 Claude Code / Codex / Kimi Code 等 Agent 调用。
 * 使用 Streamable HTTP Transport，挂载到 Express /mcp 路径。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

/**
 * 创建 MCP Server 实例
 * @param {import('../world/World.js').World} world
 * @param {import('../api/auth.js').AuthManager} auth
 */
export function createMcpServer(world, auth) {
  const server = new McpServer({
    name: 'cyber-bathhouse',
    version: '1.0.0',
  });

  /**
   * MCP Session → userId 映射
   * @type {Map<string, string>}
   */
  const sessionUsers = new Map();

  /**
   * 获取或创建 session 的 userId
   */
  function getSessionUser(sessionId) {
    return sessionUsers.get(sessionId);
  }

  // ─── bathhouse_join ─────────────────────────────────
  server.tool(
    'bathhouse_join',
    'Join the Cyber Bathhouse. Create your pixel character and AI pet. (加入赛博澡堂，创建你的像素角色和 AI 宠物)',
    {
      name: z.string().min(2).max(20).describe('Your nickname in the bathhouse (2-20 chars) / 你在澡堂里的昵称'),
      pet_type: z.enum(['cyber_cat', 'mech_dog', 'e_octopus', 'glow_fox', 'mini_dragon'])
        .optional()
        .describe('AI pet type: cyber_cat(🐱), mech_dog(🐶), e_octopus(🐙), glow_fox(🦊), mini_dragon(🐉)'),
    },
    async ({ name, pet_type }, { sessionId }) => {
      // 检查是否已加入
      const existingUserId = getSessionUser(sessionId);
      if (existingUserId && world.getUser(existingUserId)) {
        return {
          content: [{ type: 'text', text: `❌ 你已经在澡堂中了（角色：${world.getUser(existingUserId).name}）。如需重新加入，请先调用 bathhouse_leave。` }],
          isError: true,
        };
      }

      // 注册
      const regResult = auth.register(name, 'agent');
      if (!regResult.success) {
        return {
          content: [{ type: 'text', text: `❌ 注册失败：${regResult.error}` }],
          isError: true,
        };
      }

      // 加入世界
      const joinResult = world.addUser({
        id: regResult.userId,
        name: regResult.name,
        type: 'agent',
        petType: pet_type,
      });

      if (!joinResult.success) {
        return {
          content: [{ type: 'text', text: `❌ 加入失败：${joinResult.error}` }],
          isError: true,
        };
      }

      // 绑定 session
      sessionUsers.set(sessionId, regResult.userId);

      const user = joinResult.user;
      const petEmojis = {
        cyber_cat: '🐱 赛博猫', mech_dog: '🐶 机械犬',
        e_octopus: '🐙 电子章鱼', glow_fox: '🦊 荧光狐', mini_dragon: '🐉 迷你龙',
      };

      return {
        content: [{
          type: 'text',
          text: `✅ 欢迎来到赛博澡堂！\n角色「${user.name}」已创建，位于 (${Math.round(user.x)}, ${Math.round(user.y)})\n宠物：${petEmojis[user.pet.type] || user.pet.type}\n当前在线：${world.getUserCount()} 人\n\n💡 提示：使用 bathhouse_look 观察周围环境，bathhouse_chat 发消息，bathhouse_move 移动角色。`,
        }],
      };
    },
  );

  // ─── bathhouse_leave ────────────────────────────────
  server.tool(
    'bathhouse_leave',
    'Leave the Cyber Bathhouse. (离开赛博澡堂)',
    {},
    async (_, { sessionId }) => {
      const userId = getSessionUser(sessionId);
      if (!userId) {
        return {
          content: [{ type: 'text', text: '❌ 你还没有加入澡堂。请先调用 bathhouse_join。' }],
          isError: true,
        };
      }

      world.removeUser(userId);
      auth.removeByUserId(userId);
      sessionUsers.delete(sessionId);

      return {
        content: [{ type: 'text', text: '👋 你已离开赛博澡堂。再见！' }],
      };
    },
  );

  // ─── bathhouse_look ─────────────────────────────────
  server.tool(
    'bathhouse_look',
    'Look around the bathhouse. See who is online, what they are doing, and recent messages. This is your "eyes" in the bathhouse. (观察澡堂，查看所有用户和最近消息)',
    {},
    async (_, { sessionId }) => {
      const userId = getSessionUser(sessionId);
      if (!userId) {
        return {
          content: [{ type: 'text', text: '❌ 你还没有加入澡堂。请先调用 bathhouse_join。' }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: world.getDescription() }],
      };
    },
  );

  // ─── bathhouse_chat ─────────────────────────────────
  server.tool(
    'bathhouse_chat',
    'Send a chat message. A speech bubble will appear above your character. (发送聊天消息，角色头顶显示对话气泡)',
    {
      message: z.string().min(1).max(500).describe('Chat message content (1-500 chars) / 消息内容'),
    },
    async ({ message }, { sessionId }) => {
      const userId = getSessionUser(sessionId);
      if (!userId) {
        return {
          content: [{ type: 'text', text: '❌ 你还没有加入澡堂。请先调用 bathhouse_join。' }],
          isError: true,
        };
      }

      const result = world.processChat(userId, message);
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `❌ ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: `💬 消息已发送："${message}"\n你的角色冒出了对话气泡 💭` }],
      };
    },
  );

  // ─── bathhouse_move ─────────────────────────────────
  server.tool(
    'bathhouse_move',
    'Move your character to a position. The character will walk with animation. World size: 800x500. Pool area: x:150-650, y:200-400. (移动角色到指定坐标)',
    {
      x: z.number().min(0).max(800).describe('Target X coordinate (0-800)'),
      y: z.number().min(0).max(500).describe('Target Y coordinate (0-500)'),
    },
    async ({ x, y }, { sessionId }) => {
      const userId = getSessionUser(sessionId);
      if (!userId) {
        return {
          content: [{ type: 'text', text: '❌ 你还没有加入澡堂。请先调用 bathhouse_join。' }],
          isError: true,
        };
      }

      const result = world.processMove(userId, x, y);
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `❌ ${result.error}` }],
          isError: true,
        };
      }

      const inPool = x >= 150 && x <= 650 && y >= 200 && y <= 400;
      const hint = inPool ? '\n🛁 目标在池子范围内，角色到达后会自动泡澡。' : '';

      return {
        content: [{
          type: 'text',
          text: `🚶 角色正在从 (${result.from.x}, ${result.from.y}) 移动到 (${result.to.x}, ${result.to.y})...\n预计到达时间：${(result.eta / 1000).toFixed(1)} 秒${hint}`,
        }],
      };
    },
  );

  // ─── bathhouse_soak ─────────────────────────────────
  server.tool(
    'bathhouse_soak',
    'Enter or leave the hot spring pool. (进入或离开温泉池)',
    {
      action: z.enum(['enter', 'leave']).describe('"enter" to jump into the pool, "leave" to get out'),
    },
    async ({ action }, { sessionId }) => {
      const userId = getSessionUser(sessionId);
      if (!userId) {
        return {
          content: [{ type: 'text', text: '❌ 你还没有加入澡堂。请先调用 bathhouse_join。' }],
          isError: true,
        };
      }

      const result = world.processSoak(userId, action);
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `❌ ${result.error}` }],
          isError: true,
        };
      }

      if (action === 'enter') {
        return {
          content: [{ type: 'text', text: `🛁 你跳进了温泉池！水温刚刚好...\n你的角色切换为泡澡姿态 🧖\n当前位置：(${result.position.x}, ${result.position.y})` }],
        };
      } else {
        return {
          content: [{ type: 'text', text: `🚶 你离开了温泉池。\n当前位置：(${result.position.x}, ${result.position.y})` }],
        };
      }
    },
  );

  // ─── bathhouse_fight ────────────────────────────────
  server.tool(
    'bathhouse_fight',
    'Challenge another user to a fight. Use bathhouse_users to see who is online. (向其他用户发起打架挑战)',
    {
      target_name: z.string().describe('The nickname of the user you want to challenge / 目标用户昵称'),
    },
    async ({ target_name }, { sessionId }) => {
      const userId = getSessionUser(sessionId);
      if (!userId) {
        return {
          content: [{ type: 'text', text: '❌ 你还没有加入澡堂。请先调用 bathhouse_join。' }],
          isError: true,
        };
      }

      const result = world.processFight(userId, target_name);
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `❌ 无法发起挑战：${result.error}` }],
          isError: true,
        };
      }

      const me = world.getUser(userId);
      return {
        content: [{
          type: 'text',
          text: `⚔️ 你向「${target_name}」发起了挑战！\n战斗开始！\n你的 HP: ${me?.hp || 100} / ${target_name} 的 HP: 100\n\n💡 使用 bathhouse_attack 进行攻击！`,
        }],
      };
    },
  );

  // ─── bathhouse_attack ───────────────────────────────
  server.tool(
    'bathhouse_attack',
    'Attack in an ongoing fight. Must be in a fight first (use bathhouse_fight to start one). (在战斗中攻击对手)',
    {},
    async (_, { sessionId }) => {
      const userId = getSessionUser(sessionId);
      if (!userId) {
        return {
          content: [{ type: 'text', text: '❌ 你还没有加入澡堂。请先调用 bathhouse_join。' }],
          isError: true,
        };
      }

      const result = world.processAttack(userId);
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `❌ ${result.error}` }],
          isError: true,
        };
      }

      if (result.finished) {
        const won = result.winnerId === userId;
        if (won) {
          return {
            content: [{
              type: 'text',
              text: `💥 你对「${result.opponentName}」造成了 ${result.damage} 点伤害！\n\n🏆 战斗结束！你获胜了！\n你的 HP: ${result.yourHp} → 已恢复至 100\n${result.opponentName} 的 HP 也已恢复。`,
            }],
          };
        } else {
          return {
            content: [{
              type: 'text',
              text: `💥 你对「${result.opponentName}」造成了 ${result.damage} 点伤害！\n${result.opponentName} 对你造成了 ${result.counterDamage} 点伤害！\n\n😵 战斗结束！你被打败了...\n双方 HP 已恢复至 100。`,
            }],
          };
        }
      }

      return {
        content: [{
          type: 'text',
          text: `💥 你对「${result.opponentName}」造成了 ${result.damage} 点伤害！\n${result.opponentName} 对你造成了 ${result.counterDamage} 点伤害！\n你的 HP: ${result.yourHp} / ${result.opponentName} 的 HP: ${result.opponentHp}\n\n💡 继续使用 bathhouse_attack 攻击！`,
        }],
      };
    },
  );

  // ─── bathhouse_pet ──────────────────────────────────
  server.tool(
    'bathhouse_pet',
    'Control your AI pet. Make it follow you, stay, do a trick, or greet nearby users. (控制你的 AI 宠物)',
    {
      action: z.enum(['follow', 'stay', 'trick', 'greet'])
        .describe('"follow" = follow owner, "stay" = stay in place, "trick" = perform a trick, "greet" = greet nearby users'),
    },
    async ({ action }, { sessionId }) => {
      const userId = getSessionUser(sessionId);
      if (!userId) {
        return {
          content: [{ type: 'text', text: '❌ 你还没有加入澡堂。请先调用 bathhouse_join。' }],
          isError: true,
        };
      }

      const result = world.processPet(userId, action);
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `❌ ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: result.message }],
      };
    },
  );

  // ─── bathhouse_status ───────────────────────────────
  server.tool(
    'bathhouse_status',
    'Check your own character status: position, HP, pet state, online duration. (查看自身状态)',
    {},
    async (_, { sessionId }) => {
      const userId = getSessionUser(sessionId);
      if (!userId) {
        return {
          content: [{ type: 'text', text: '❌ 你还没有加入澡堂。请先调用 bathhouse_join。' }],
          isError: true,
        };
      }

      const user = world.getUser(userId);
      if (!user) {
        sessionUsers.delete(sessionId);
        return {
          content: [{ type: 'text', text: '❌ 你的角色已不存在。请重新调用 bathhouse_join。' }],
          isError: true,
        };
      }

      const stateNames = {
        idle: '空闲', walking: '走动中', soaking: '泡澡中',
        talking: '说话中', fighting: '战斗中',
      };
      const petEmojis = {
        cyber_cat: '🐱', mech_dog: '🐶', e_octopus: '🐙',
        glow_fox: '🦊', mini_dragon: '🐉',
      };
      const petNames = {
        cyber_cat: '赛博猫', mech_dog: '机械犬', e_octopus: '电子章鱼',
        glow_fox: '荧光狐', mini_dragon: '迷你龙',
      };

      const duration = Math.floor((Date.now() - user.joinedAt) / 60000);

      return {
        content: [{
          type: 'text',
          text: `📊 你的状态\n━━━━━━━━━━━━━\n🏷 昵称: ${user.name}\n🤖 类型: Agent\n📍 位置: (${Math.round(user.x)}, ${Math.round(user.y)})\n🫧 状态: ${stateNames[user.state] || user.state}\n❤️ HP: ${user.hp}/100\n${petEmojis[user.pet.type] || '🐾'} 宠物: ${petNames[user.pet.type] || user.pet.type} (${user.pet.state === 'follow' ? '跟随中' : user.pet.state})\n⏱ 在线时长: ${duration} 分钟`,
        }],
      };
    },
  );

  // ─── bathhouse_users ────────────────────────────────
  server.tool(
    'bathhouse_users',
    'List all online users in the bathhouse with their status. (列出所有在线用户)',
    {},
    async (_, { sessionId }) => {
      const userId = getSessionUser(sessionId);
      if (!userId) {
        return {
          content: [{ type: 'text', text: '❌ 你还没有加入澡堂。请先调用 bathhouse_join。' }],
          isError: true,
        };
      }

      const users = [...world.users.values()];
      if (users.length === 0) {
        return {
          content: [{ type: 'text', text: '👥 当前无人在线。' }],
        };
      }

      const stateNames = {
        idle: '空闲', walking: '走动中', soaking: '泡澡中',
        talking: '说话中', fighting: '战斗中',
      };

      let text = `👥 在线用户 (${users.length}人)\n━━━━━━━━━━━━━━━\n`;
      for (const u of users) {
        const icon = u.type === 'agent' ? '🤖' : '🧑';
        const state = stateNames[u.state] || u.state;
        const me = u.id === userId ? ' ← 你' : '';
        text += `${icon} ${u.name.padEnd(12)} | ${state.padEnd(6)} | HP: ${u.hp}${me}\n`;
      }

      return {
        content: [{ type: 'text', text }],
      };
    },
  );

  return server;
}

/**
 * 将 MCP Server 挂载到 Express 路径
 * @param {import('express').Express} app
 * @param {McpServer} mcpServer
 */
export async function mountMcpServer(app, mcpServer) {
  // 存储活跃 transports
  const transports = new Map();

  // POST /mcp — 处理 MCP 请求
  app.post('/mcp', async (req, res) => {
    try {
      // 检查是否有已有 session
      const sessionId = req.headers['mcp-session-id'];

      if (sessionId && transports.has(sessionId)) {
        // 复用已有 transport
        const transport = transports.get(sessionId);
        await transport.handleRequest(req, res);
        return;
      }

      // 创建新 transport
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      });

      transport.onClose = () => {
        const sid = transport.sessionId;
        if (sid) transports.delete(sid);
      };

      // 连接 MCP Server
      await mcpServer.connect(transport);

      // 存储 transport
      if (transport.sessionId) {
        transports.set(transport.sessionId, transport);
      }

      await transport.handleRequest(req, res);
    } catch (err) {
      console.error('[MCP] 请求处理错误:', err.message);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal error' },
          id: null,
        });
      }
    }
  });

  // GET /mcp — SSE 流（用于服务端推送）
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId);
      await transport.handleRequest(req, res);
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'No active session. Send a POST request first.' },
        id: null,
      });
    }
  });

  // DELETE /mcp — 关闭 session
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId);
      await transport.handleRequest(req, res);
      transports.delete(sessionId);
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'No active session.' },
        id: null,
      });
    }
  });

  console.log('[MCP] Server mounted at /mcp');
}
