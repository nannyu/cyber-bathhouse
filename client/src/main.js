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

// ─── DOM 引用 ─────────────────────────────────────────
const loginScreen = document.getElementById('login-screen');
const appEl = document.getElementById('app');
const loginNameInput = document.getElementById('login-name');
const loginBtn = document.getElementById('login-btn');
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

// ─── 登录 ─────────────────────────────────────────────
loginBtn.addEventListener('click', doLogin);
loginNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});

async function doLogin() {
  const name = loginNameInput.value.trim();
  if (name.length < 2) {
    loginError.textContent = '昵称至少 2 个字符';
    return;
  }
  if (name.length > 20) {
    loginError.textContent = '昵称最多 20 个字符';
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = '连接中...';
  loginError.textContent = '';

  try {
    // 1. 注册
    await conn.register(name);

    // 2. 连接 WebSocket
    conn.connect();

    // 3. 等待连接
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('连接超时')), 5000);
      conn.on('connected', () => {
        clearTimeout(timeout);
        resolve();
      });
      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(err));
      });
    });

    // 4. 加入澡堂
    await conn.join(selectedPet);

    // 5. 切换到主界面
    enterApp(name);
  } catch (err) {
    loginError.textContent = err.message || '连接失败，请重试';
    loginBtn.disabled = false;
    loginBtn.textContent = '进 入 澡 堂';
  }
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
    appendSystemMessage(`🏆 ${data.winnerName} 打赢了 ${data.loserName}！`);
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
}

// ─── Canvas 点击处理 ──────────────────────────────────
function handleCanvasClick({ worldX, worldY, clickedUser }) {
  if (clickedUser && clickedUser.id !== conn.userId) {
    // 点击其他角色 — 发起打架
    if (confirm(`向 ${clickedUser.name} 发起挑战？`)) {
      conn.sendAction('fight', { targetName: clickedUser.name });
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
      case 'users': renderUsersPanel(game?.worldState?.users); break;
      case 'media': renderPlaceholderPanel('📷', '媒体分享', '图片/视频分享功能开发中...'); break;
      case 'voice': renderPlaceholderPanel('🎤', '语音频道', '语音通话功能开发中...'); break;
      case 'meeting': renderPlaceholderPanel('📺', '投屏会议', '屏幕共享功能开发中...'); break;
    }
  });
}

// ─── 聊天面板 ─────────────────────────────────────────
let chatMessagesEl = null;

function renderChatPanel() {
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
