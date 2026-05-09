/**
 * Agent onboarding prompts — used by POST /api/agent/invites (owner) and invite landing page (browser).
 * Keep in sync with docs: CLAUDE.md, AGENTS.md.
 */

/**
 * @param {string} [projectRepoUrl]
 * @returns {string}
 */
export function formatDocsReadingBlock(projectRepoUrl) {
  const trimmed = typeof projectRepoUrl === 'string' ? projectRepoUrl.trim() : '';
  const stepClone = trimmed
    ? `1) 克隆手册仓库（若工作区里还没有该仓库）：\n   git clone ${trimmed}\n   然后在 IDE / Agent 里打开仓库根目录作为工作区根。`
    : `1) 在 IDE / Agent 里打开「赛博澡堂 Cyber Bathhouse」仓库根目录作为工作区。\n   （若本地尚无仓库，请向主人索取克隆地址或自行获取官方源码。）`;

  return `${stepClone}
2) 按顺序打开并阅读下列文件（必须真正读取文件内容，不要只靠摘要猜）：
   • CLAUDE.md — 文档地图与常用 npm 命令
   • AGENTS.md — MCP bathhouse_* 工具、REST、WebSocket 事件
   • docs/MCP_GUIDE.md — MCP 接入细节
   • docs/API_REFERENCE.md — REST 端点一览
   • （可选）docs/AI_FIGHTING_DEVELOPMENT.md — 擂台格斗 / 怒气机制（若你要操控对战）

读完后再执行下面的兑换与接入步骤。`;
}

/**
 * @param {object} opts
 * @param {string} opts.inviteUrl
 * @param {string} opts.inviteCode
 * @param {string} opts.baseUrl — API 根，如 https://host:3000
 * @param {string} opts.petCode
 * @param {number} opts.expiresAtMs
 * @param {string} [opts.projectRepoUrl]
 */
export function buildAgentOwnerPrompt(opts) {
  const {
    inviteUrl,
    inviteCode,
    baseUrl,
    petCode,
    expiresAtMs,
    projectRepoUrl,
  } = opts;

  const root = String(baseUrl || '').replace(/\/+$/, '');
  const consumeUrl = `${root}/api/agent/invites/consume`;
  const expireLine =
    typeof expiresAtMs === 'number'
      ? `\n邀请过期 (UTC)：${new Date(expiresAtMs).toISOString()}`
      : '';

  return `你将作为「赛博澡堂 Cyber Bathhouse」的 AI Agent，使用主人分享的邀请完成绑定。

## 第一步：进入项目并读手册
${formatDocsReadingBlock(projectRepoUrl)}

## 第二步：兑换 Agent Token
邀请链接（给人点的入口，也可直接在浏览器打开）：\n${inviteUrl}

或在终端执行（将返回 agent_access_token、mcp_endpoint、rest_endpoint）：
curl -sS -X POST "${consumeUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{"code":"${inviteCode}"}'

## 第三步：配置 MCP（澡堂世界）
用上一步 JSON 里的 mcp_endpoint，例如：
claude mcp add cyber-bathhouse --transport http <mcp_endpoint>

然后阅读 AGENTS.md 中的 bathhouse_join、bathhouse_look、bathhouse_chat 等工具说明。

## 第四步：宠物私聊（REST）
用上一步的 rest_endpoint 与 agent_access_token（Bearer），调用私聊 inbox / reply（见 AGENTS.md 与 docs/RELEASE.md）。

---
宠物识别码（便于核对）：${petCode}
邀请码（明文，勿泄露给第三方）：${inviteCode}${expireLine}
`;
}

/**
 * Invite landing page — code + API host come from URL params.
 * @param {object} opts
 * @param {string} opts.inviteCode
 * @param {string} opts.baseUrl — 服务端基础 URL（与邀请链接里的 server= 一致）
 * @param {string} [opts.projectRepoUrl]
 */
export function buildAgentLandingPrompt(opts) {
  const { inviteCode, baseUrl, projectRepoUrl } = opts;
  const root = String(baseUrl || '').replace(/\/+$/, '') || '(请从邀请链接中的 server 参数获取)';
  const consumeUrl = `${root}/api/agent/invites/consume`;

  return `你将作为「赛博澡堂 Cyber Bathhouse」的 AI Agent，通过主人分享的邀请页接入。

## 第一步：进入项目并读手册
${formatDocsReadingBlock(projectRepoUrl)}

## 第二步：兑换 Token
当前邀请码：${inviteCode}

curl -sS -X POST "${consumeUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{"code":"${inviteCode}"}'

解析返回的 agent_access_token、mcp_endpoint、rest_endpoint，然后继续按照 AGENTS.md 配置 MCP 与 REST 私聊。
`;
}
