/**
 * 赛博澡堂 — 前端入口
 */

import './styles/index.css';
import { Connection } from './net/Connection.js';
import { Game } from './engine/Game.js';

// ─── 全局实例 ─────────────────────────────────────────
const conn = new Connection();
let game = null;
let currentTab = 'chat';
let petProfile = null;
let privateChatThread = null;
let privateChatLastTs = 0;
let privateChatPollTimer = null;

// ─── DOM 引用 ─────────────────────────────────────────
const loginScreen = document.getElementById('login-screen');
const appEl = document.getElementById('app');

const authTabs = document.querySelectorAll('.auth-tab');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');

const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');

const regUsernameInput = document.getElementById('reg-username');
const regPasswordInput = document.getElementById('reg-password');
const regNicknameInput = document.getElementById('reg-nickname');

const authBtn = document.getElementById('auth-btn');
const loginError = document.getElementById('login-error');
const petSelect = document.getElementById('pet-select');
const headerInfo = document.getElementById('header-info');
const footerStatus = document.getElementById('footer-status');
const footerUser = document.getElementById('footer-user');
const sidebarTabs = document.getElementById('sidebar-tabs');
const sidebarContent = document.getElementById('sidebar-content');
const canvas = document.getElementById('bathhouse-canvas');

let selectedPet = 'cyber_cat';

// ─── 宠物选择 ─────────────────────────────────────────
petSelect.addEventListener('click', (e) => {
  const btn = e.target.closest('.pet-option');
  if (!btn) return;

  petSelect.querySelectorAll('.pet-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedPet = btn.dataset.pet;
});

// ─── 初始化与自动登录 ──────────────────────────────────
let authMode = 'login'; // 'login' | 'register'

authTabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    authTabs.forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    authMode = e.target.dataset.mode;
    
    if (authMode === 'login') {
      formLogin.classList.remove('hidden');
      formLogin.classList.add('active');
      formRegister.classList.add('hidden');
      formRegister.classList.remove('active');
    } else {
      formRegister.classList.remove('hidden');
      formRegister.classList.add('active');
      formLogin.classList.add('hidden');
      formLogin.classList.remove('active');
    }
    loginError.textContent = '';
  });
});

authBtn.addEventListener('click', doAuth);
[loginUsernameInput, loginPasswordInput, regUsernameInput, regPasswordInput, regNicknameInput].forEach(inp => {
  if (inp) {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doAuth();
    });
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  const success = await conn.tryAutoLogin();
  if (success) {
    await performJoinWorld();
    enterApp(conn.userName);
  }
});

async function doAuth() {
  loginError.textContent = '';
  authBtn.disabled = true;
  authBtn.textContent = '连接中...';

  try {
    if (authMode === 'login') {
      const u = loginUsernameInput.value.trim();
      const p = loginPasswordInput.value.trim();
      if (!u || !p) throw new Error('请输入完整的登录信息');
      await conn.login(u, p);
    } else {
      const u = regUsernameInput.value.trim();
      const p = regPasswordInput.value.trim();
      const n = regNicknameInput.value.trim();
      if (!u || !p || !n) throw new Error('请输入完整的注册信息');
      await conn.register(u, p, n);
    }

    await performJoinWorld();
    enterApp(conn.userName);

  } catch (err) {
    loginError.textContent = err.message || '网关连接失败';
    authBtn.disabled = false;
    authBtn.textContent = '进 入 澡 堂';
  }
}

async function performJoinWorld() {
  conn.connect();
  // 等待连接
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket连接超时')), 5000);
    conn.on('connected', () => {
      clearTimeout(timeout);
      resolve();
    });
    conn.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(err));
    });
  });

  // 加入澡堂
  await conn.join(selectedPet);
}

// ─── 进入主应用 ───────────────────────────────────────
function enterApp(name) {
  loginScreen.classList.add('hidden');
  appEl.classList.remove('hidden');

  footerUser.textContent = `🧑 ${name}`;
  footerStatus.textContent = '🟢 已连接';

  // 初始化游戏
  game = new Game(canvas);
  game.myUserId = conn.userId;
  game.start();

  // Canvas 点击事件
  game.onCanvasClick = handleCanvasClick;

  // 监听服务端事件
  conn.on('world:update', (state) => {
    game.updateState(state);
    headerInfo.textContent = `在线: ${state.users?.length || 0} 人`;

    // 更新用户列表面板
    if (currentTab === 'users') renderUsersPanel(state.users);
  });

  conn.on('world:state', (state) => {
    game.updateState(state);
    // 加载历史消息
    if (state.recentMessages) {
      for (const msg of state.recentMessages) {
        appendChatMessage(msg);
      }
    }
  });

  conn.on('chat:message', (msg) => {
    appendChatMessage(msg);
  });

  conn.on('user:joined', (user) => {
    appendSystemMessage(`${user.type === 'agent' ? '🤖' : '🧑'} ${user.name} 加入了澡堂`);
  });

  conn.on('user:left', (data) => {
    appendSystemMessage(`👋 ${data.name} 离开了澡堂`);
  });

  conn.on('fight:started', (data) => {
    appendSystemMessage(`⚔️ ${data.attacker.name} 向 ${data.defender.name} 发起了挑战！`);
  });

  conn.on('fight:ended', (data) => {
    if (game) game.handleFightEnded(data);
    if (data.flee) {
      appendSystemMessage(`🏃 ${data.loserName} 临阵脱逃了，${data.winnerName} 获胜！`);
    } else {
      appendSystemMessage(`🏆 ${data.winnerName} 打赢了 ${data.loserName}！`);
    }
  });

  conn.on('fight:hit', (data) => {
    if (game) game.handleFightHit(data);

    const actions = ['左勾拳', '回旋踢', '头槌', '过肩摔', '黑虎掏心', '升龙拳', '扫堂腿'];
    const act1 = actions[Math.floor(Math.random() * actions.length)];
    const act2 = actions[Math.floor(Math.random() * actions.length)];
    
    let msg = `💥 ${data.attackerName}使出${act1}`;
    msg += data.attackerDamage > 0 ? `(${data.defenderName} HP-${data.attackerDamage})` : `(被闪避)`;
    msg += `，${data.defenderName}回敬${act2}`;
    msg += data.counterDamage > 0 ? `(${data.attackerName} HP-${data.counterDamage})` : `(被闪避)`;

    appendSystemMessage(msg);
  });

  conn.on('disconnected', () => {
    footerStatus.textContent = '🔴 已断开';
  });

  conn.on('connected', () => {
    footerStatus.textContent = '🟢 已连接';
  });

  // 初始化侧边栏
  initSidebar();
  renderChatPanel();
  loadPetProfile();
}

// ─── Canvas 点击处理 ──────────────────────────────────
function handleCanvasClick({ worldX, worldY, clickedUser, clickedPetOwner }) {
  if (clickedPetOwner?.id === conn.userId) {
    openPrivateTabFromPetClick();
    return;
  }
  if (clickedUser) {
    if (clickedUser.id === conn.userId) {
      if (clickedUser.state === 'fighting') {
        if (confirm(`确认逃跑认输吗？`)) {
          conn.sendAction('flee', {});
        }
      }
    } else {
      // 点击其他角色 — 发起打架
      if (confirm(`向 ${clickedUser.name} 发起挑战？`)) {
        conn.sendAction('fight', { targetName: clickedUser.name });
      }
    }
  } else {
    // 点击空地 — 移动
    conn.sendMove(worldX, worldY);
  }
}

// ─── 侧边栏 ──────────────────────────────────────────
function initSidebar() {
  sidebarTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;

    sidebarTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;

    switch (currentTab) {
      case 'chat': renderChatPanel(); break;
      case 'private': renderPrivatePanel(); break;
      case 'pet': renderPetPanel(); break;
      case 'users': renderUsersPanel(game?.worldState?.users); break;
      case 'admin': renderAdminPanel(); break;
    }
  });
}

// ─── 聊天面板 ─────────────────────────────────────────
let chatMessagesEl = null;

function renderChatPanel() {
  stopPrivateChatPolling();
  sidebarContent.innerHTML = `
    <div class="panel">
      <div class="panel-header">💬 CHAT</div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-input-bar">
        <input type="text" class="chat-input" id="chat-input" placeholder="输入消息..." maxlength="500" autocomplete="off" />
        <button class="chat-send-btn" id="chat-send">发送</button>
      </div>
    </div>
  `;

  chatMessagesEl = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');

  // 恢复历史消息
  for (const msg of chatHistory) {
    _appendMessageDOM(msg);
  }
  scrollChatToBottom();

  chatSend.addEventListener('click', () => sendChatMessage(chatInput));
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage(chatInput);
  });
}

async function loadPetProfile() {
  try {
    petProfile = await conn.getPetProfile();
  } catch (error) {
    console.error(error);
  }
}

async function openPrivateTabFromPetClick() {
  currentTab = 'private';
  sidebarTabs.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  sidebarTabs.querySelector('.tab-btn[data-tab="private"]')?.classList.add('active');
  await renderPrivatePanel();
}

async function renderPrivatePanel() {
  sidebarContent.innerHTML = `
    <div class="panel">
      <div class="panel-header">🐾 PET PRIVATE CHAT</div>
      <div class="chat-system" id="pet-chat-mode-hint">当前模式：${petProfile?.chatVisibility === 'private' ? '私聊（仅你可见）' : '公开（全服可见）'}</div>
      <div class="chat-messages" id="private-messages"></div>
      <div class="chat-input-bar">
        <input type="text" class="chat-input" id="private-input" placeholder="给宠物发送私聊..." maxlength="1000" />
        <button class="chat-send-btn" id="private-send">发送</button>
      </div>
    </div>
  `;

  const messagesEl = document.getElementById('private-messages');
  const inputEl = document.getElementById('private-input');
  const sendBtn = document.getElementById('private-send');

  try {
    const result = await conn.summonPetChat();
    petProfile = result.pet;
    privateChatThread = result.thread;
    privateChatLastTs = 0;
    messagesEl.innerHTML = '';
    (result.messages || []).forEach((msg) => {
      appendPrivateMessageDOM(messagesEl, msg);
      privateChatLastTs = Math.max(privateChatLastTs, msg.createdAt || 0);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
    startPrivateChatPolling(messagesEl);
  } catch (error) {
    messagesEl.innerHTML = `<div class="chat-system">私聊初始化失败：${escapeHtml(error.message || '未知错误')}</div>`;
  }

  sendBtn.addEventListener('click', async () => {
    const text = inputEl.value.trim();
    if (!text || !privateChatThread) return;
    try {
      const result = await conn.sendPrivateMessage(privateChatThread.id, text);
      appendPrivateMessageDOM(messagesEl, result.message);
      privateChatLastTs = Math.max(privateChatLastTs, result.message.createdAt || 0);
      if (result.publicDelivered === false && result.warning) {
        appendSystemMessage(`公开模式投递失败：${result.warning}`);
      }
      inputEl.value = '';
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } catch (error) {
      appendSystemMessage(`私聊发送失败：${error.message || '未知错误'}`);
    }
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendBtn.click();
  });
}

function appendPrivateMessageDOM(container, msg) {
  const div = document.createElement('div');
  div.className = 'chat-message';
  const fromAgent = msg.senderType === 'agent';
  const label = fromAgent ? (petProfile?.petNickname || '你的宠物') : '你';
  const time = new Date(msg.createdAt || Date.now()).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `
    <div class="chat-message__name ${fromAgent ? 'chat-message__name--agent' : ''}">${fromAgent ? '🤖 ' : '🧑 '}${escapeHtml(label)}</div>
    <div class="chat-message__text">${escapeHtml(msg.content || '')}</div>
    <div class="chat-message__time">${time}</div>
  `;
  container.appendChild(div);
}

function startPrivateChatPolling(container) {
  stopPrivateChatPolling();
  privateChatPollTimer = setInterval(async () => {
    if (currentTab !== 'private' || !privateChatThread) return;
    try {
      const messages = await conn.fetchPrivateMessages(privateChatThread.id, privateChatLastTs);
      messages.forEach((msg) => {
        appendPrivateMessageDOM(container, msg);
        privateChatLastTs = Math.max(privateChatLastTs, msg.createdAt || 0);
      });
      if (messages.length > 0) {
        container.scrollTop = container.scrollHeight;
      }
    } catch (_) {
      // 静默轮询失败
    }
  }, 2000);
}

function stopPrivateChatPolling() {
  if (privateChatPollTimer) {
    clearInterval(privateChatPollTimer);
    privateChatPollTimer = null;
  }
}

function renderPetPanel() {
  stopPrivateChatPolling();
  const petName = petProfile?.petNickname || '';
  const petCode = petProfile?.petCode || '加载中...';
  sidebarContent.innerHTML = `
    <div class="panel">
      <div class="panel-header">🛠️ PET SETTINGS</div>
      <div class="settings-form">
        <label class="login-label">宠物昵称</label>
        <input id="pet-nickname-input" class="login-input" value="${escapeHtml(petName)}" maxlength="20" />
        <label class="login-label">识别码（只读）</label>
        <input class="login-input" value="${escapeHtml(petCode)}" readonly />
        <label class="login-label">与宠物对话形式</label>
        <select id="pet-chat-visibility" class="login-input">
          <option value="public" ${(petProfile?.chatVisibility || 'public') === 'public' ? 'selected' : ''}>公开（默认，所有人可见）</option>
          <option value="private" ${petProfile?.chatVisibility === 'private' ? 'selected' : ''}>私聊（仅自己可见）</option>
        </select>
        <div class="settings-actions">
          <button id="save-pet-settings" class="chat-send-btn">保存昵称</button>
          <button id="create-agent-invite" class="chat-send-btn">生成 Agent 邀请链接</button>
        </div>
        <textarea id="agent-invite-output" class="login-input" rows="4" placeholder="邀请链接会显示在这里..." readonly></textarea>
      </div>
    </div>
  `;
  document.getElementById('save-pet-settings')?.addEventListener('click', async () => {
    if (!petProfile) return;
    const nickname = document.getElementById('pet-nickname-input').value.trim();
    const chatVisibility = document.getElementById('pet-chat-visibility').value;
    try {
      petProfile = await conn.updatePetSettings(petProfile.id, nickname, chatVisibility);
      appendSystemMessage('宠物设置已更新');
    } catch (error) {
      appendSystemMessage(`宠物设置更新失败：${error.message || '未知错误'}`);
    }
  });
  document.getElementById('create-agent-invite')?.addEventListener('click', async () => {
    const output = document.getElementById('agent-invite-output');
    try {
      const result = await conn.createAgentInvite();
      output.value = result.inviteUrl;
    } catch (error) {
      output.value = `生成失败：${error.message || '未知错误'}`;
    }
  });
}

async function renderAdminPanel() {
  stopPrivateChatPolling();
  if (conn.userRole !== 'admin') {
    renderPlaceholderPanel('🧭', '管理后台', '当前账号不是管理员');
    return;
  }
  sidebarContent.innerHTML = `
    <div class="panel">
      <div class="panel-header">🧭 ADMIN</div>
      <div class="admin-grid">
        <section>
          <h4>系统设置</h4>
          <div id="admin-settings-list"></div>
          <div class="chat-input-bar">
            <input id="admin-setting-key" class="chat-input" placeholder="配置 Key" />
            <input id="admin-setting-value" class="chat-input" placeholder="配置 Value" />
            <button id="admin-setting-save" class="chat-send-btn">保存</button>
          </div>
        </section>
        <section>
          <h4>用户角色</h4>
          <div id="admin-users-list"></div>
        </section>
      </div>
    </div>
  `;
  const settingsList = document.getElementById('admin-settings-list');
  const usersList = document.getElementById('admin-users-list');
  try {
    const [settings, users] = await Promise.all([conn.getAdminSettings(), conn.getAdminUsers()]);
    settingsList.innerHTML = settings.map((item) => `<div class="admin-row"><code>${escapeHtml(item.key)}</code><span>${escapeHtml(item.value)}</span></div>`).join('') || '<div class="chat-system">暂无配置</div>';
    usersList.innerHTML = users.map((u) => `
      <div class="admin-row">
        <span>${escapeHtml(u.nickname)} (${escapeHtml(u.username)})</span>
        <select data-user-id="${u.userId}" class="admin-role-select">
          <option value="user" ${u.role === 'user' ? 'selected' : ''}>user</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
        </select>
      </div>
    `).join('');
  } catch (error) {
    settingsList.innerHTML = `<div class="chat-system">${escapeHtml(error.message || '加载失败')}</div>`;
  }
  document.getElementById('admin-setting-save')?.addEventListener('click', async () => {
    const key = document.getElementById('admin-setting-key').value.trim();
    const value = document.getElementById('admin-setting-value').value.trim();
    if (!key) return;
    await conn.updateAdminSetting(key, value);
    renderAdminPanel();
  });
  usersList?.addEventListener('change', async (e) => {
    const select = e.target.closest('.admin-role-select');
    if (!select) return;
    await conn.updateUserRole(select.dataset.userId, select.value);
  });
}

function sendChatMessage(input) {
  const text = input.value.trim();
  if (!text) return;
  conn.sendChat(text);
  input.value = '';
}

/** @type {Array<Object>} 聊天历史 */
const chatHistory = [];

function appendChatMessage(msg) {
  chatHistory.push(msg);
  if (chatHistory.length > 200) chatHistory.shift();

  if (chatMessagesEl && currentTab === 'chat') {
    _appendMessageDOM(msg);
    scrollChatToBottom();
  }
}

function _appendMessageDOM(msg) {
  if (!chatMessagesEl) return;

  const div = document.createElement('div');
  div.className = 'chat-message';

  const isAgent = game?.worldState?.users?.find(u => u.id === msg.userId)?.type === 'agent';
  const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  div.innerHTML = `
    <div class="chat-message__name ${isAgent ? 'chat-message__name--agent' : ''}">${isAgent ? '🤖 ' : ''}${escapeHtml(msg.name)}</div>
    <div class="chat-message__text">${escapeHtml(msg.message)}</div>
    <div class="chat-message__time">${time}</div>
  `;

  chatMessagesEl.appendChild(div);
}

function appendSystemMessage(text) {
  chatHistory.push({ system: true, message: text, timestamp: Date.now() });

  if (chatMessagesEl && currentTab === 'chat') {
    const div = document.createElement('div');
    div.className = 'chat-system';
    div.textContent = text;
    chatMessagesEl.appendChild(div);
    scrollChatToBottom();
  }
}

function scrollChatToBottom() {
  if (chatMessagesEl) {
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }
}

// ─── 用户列表面板 ─────────────────────────────────────
function renderUsersPanel(users) {
  const list = (users || []).map(u => {
    const icon = u.type === 'agent' ? '🤖' : '🧑';
    const stateNames = {
      idle: '空闲', walking: '走动中', soaking: '泡澡中',
      talking: '说话中', fighting: '战斗中',
      sauna: '蒸桑拿', scrubbing: '搓澡中',
    };
    const state = stateNames[u.state] || u.state;
    const isMe = u.id === conn.userId;

    return `
      <div class="user-item" data-user-id="${u.id}">
        <span class="user-item__icon">${icon}</span>
        <div class="user-item__info">
          <div class="user-item__name">${escapeHtml(u.name)}${isMe ? ' (你)' : ''}</div>
          <div class="user-item__state">${state}</div>
        </div>
        <span class="user-item__hp">HP:${u.hp}</span>
      </div>
    `;
  }).join('');

  sidebarContent.innerHTML = `
    <div class="panel">
      <div class="panel-header">👥 USERS (${(users || []).length})</div>
      <div class="user-list">${list || '<p style="color:var(--cb-text-muted);padding:16px;text-align:center;">暂无用户</p>'}</div>
    </div>
  `;
}

// ─── 占位面板 ─────────────────────────────────────────
function renderPlaceholderPanel(icon, title, hint) {
  sidebarContent.innerHTML = `
    <div class="panel">
      <div class="panel-header">${icon} ${title.toUpperCase()}</div>
      <div class="placeholder-panel">
        <span class="placeholder-panel__icon">${icon}</span>
        <span class="placeholder-panel__text">${title}</span>
        <span class="placeholder-panel__hint">${hint}</span>
      </div>
    </div>
  `;
}

// ─── 工具函数 ─────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
