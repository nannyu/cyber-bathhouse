/**
 * 像素精灵渲染工具
 * 通过代码生成像素角色和宠物（不依赖外部图片）
 */

const PIXEL = 4; // 1 逻辑像素 = 4 屏幕像素

/**
 * 绘制像素矩形
 */
function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * PIXEL, y * PIXEL, w * PIXEL, h * PIXEL);
}

/**
 * 绘制角色精灵
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} options
 */
export function drawCharacter(ctx, { x, y, palette, state, frame, direction }) {
  ctx.save();
  ctx.translate(Math.floor(x), Math.floor(y));

  const { hair, skin, shorts } = palette;
  const f = frame % 2;
  const bounce = state === 'idle' ? (f === 0 ? 0 : -1) : 0;
  const walkOffset = state === 'walking' ? (frame % 4 < 2 ? 1 : -1) : 0;

  // 泡澡状态只画上半身
  const isSoaking = state === 'soaking';
  const bodyStart = isSoaking ? -4 : 0;

  // 头发
  px(ctx, 2, bodyStart + bounce, 8, 3, hair);
  px(ctx, 1, bodyStart + bounce + 1, 1, 2, hair);
  px(ctx, 10, bodyStart + bounce + 1, 1, 2, hair);

  // 脸
  px(ctx, 2, bodyStart + bounce + 3, 8, 4, skin);
  // 眼睛
  px(ctx, 3, bodyStart + bounce + 4, 2, 2, '#111');
  px(ctx, 7, bodyStart + bounce + 4, 2, 2, '#111');
  // 眼球光
  px(ctx, 3, bodyStart + bounce + 4, 1, 1, state === 'fighting' ? '#ff2d78' : '#fff');
  px(ctx, 7, bodyStart + bounce + 4, 1, 1, state === 'fighting' ? '#ff2d78' : '#fff');

  // 嘴巴（说话时张开）
  if (state === 'talking' && f === 0) {
    px(ctx, 4, bodyStart + bounce + 6, 4, 1, '#333');
  }

  if (!isSoaking) {
    // 身体
    px(ctx, 3, 7, 6, 4, skin);
    // 泳裤
    px(ctx, 3, 11, 6, 2, shorts);
    // 腿
    px(ctx, 3, 13, 2, 3 + walkOffset, skin);
    px(ctx, 7, 13, 2, 3 - walkOffset, skin);
  } else {
    // 水面效果
    const waterY = 7;
    px(ctx, 0, waterY, 12, 1, 'rgba(0, 240, 255, 0.3)');
  }

  // 战斗状态 — 拳头
  if (state === 'fighting') {
    const punchX = f === 0 ? 10 : -3;
    px(ctx, punchX, 7 + bounce, 3, 3, skin);
    // 拳头特效
    if (f === 0) {
      px(ctx, 13, 6 + bounce, 2, 1, '#ff2d78');
      px(ctx, 14, 7 + bounce, 1, 1, '#ff6e27');
    }
  }

  ctx.restore();
}

/**
 * 绘制宠物精灵
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} options
 */
export function drawPet(ctx, { x, y, type, state, frame }) {
  ctx.save();
  ctx.translate(Math.floor(x), Math.floor(y));

  const f = frame % 2;
  const bounce = f === 0 ? 0 : -1;

  switch (type) {
    case 'cyber_cat':
      drawCyberCat(ctx, bounce, state, f);
      break;
    case 'mech_dog':
      drawMechDog(ctx, bounce, state, f);
      break;
    case 'e_octopus':
      drawEOctopus(ctx, bounce, state, f);
      break;
    case 'glow_fox':
      drawGlowFox(ctx, bounce, state, f);
      break;
    case 'mini_dragon':
      drawMiniDragon(ctx, bounce, state, f);
      break;
    default:
      drawCyberCat(ctx, bounce, state, f);
  }

  ctx.restore();
}

function drawCyberCat(ctx, bounce, state, f) {
  const c1 = '#00f0ff';
  const c2 = '#b829dd';
  // 身体
  px(ctx, 1, 2 + bounce, 6, 4, c1);
  // 头
  px(ctx, 0, 0 + bounce, 8, 3, c1);
  // 耳朵
  px(ctx, 0, -1 + bounce, 2, 1, c2);
  px(ctx, 6, -1 + bounce, 2, 1, c2);
  // 发光眼睛
  px(ctx, 1, 1 + bounce, 2, 1, '#fff');
  px(ctx, 5, 1 + bounce, 2, 1, '#fff');
  px(ctx, 1, 1 + bounce, 1, 1, c2);
  px(ctx, 5, 1 + bounce, 1, 1, c2);
  // 尾巴
  px(ctx, 7, 3 + bounce + f, 1, 2, c2);
  px(ctx, 8, 2 + bounce + f, 1, 1, c2);
  // 腿
  px(ctx, 1, 6 + bounce, 2, 1, c1);
  px(ctx, 5, 6 + bounce, 2, 1, c1);
}

function drawMechDog(ctx, bounce, state, f) {
  const c1 = '#ff6e27';
  const c2 = '#39ff14';
  // 身体
  px(ctx, 1, 2 + bounce, 7, 4, c1);
  // 头
  px(ctx, 0, 0 + bounce, 6, 3, c1);
  // 天线耳朵
  px(ctx, 0, -2 + bounce, 1, 2, c2);
  px(ctx, 5, -2 + bounce, 1, 2, c2);
  px(ctx, 0, -2 + bounce, 1, 1, '#fff');
  px(ctx, 5, -2 + bounce, 1, 1, '#fff');
  // 眼睛
  px(ctx, 1, 1 + bounce, 2, 1, c2);
  px(ctx, 3, 1 + bounce, 2, 1, c2);
  // 鼻子
  px(ctx, 2, 2 + bounce, 2, 1, '#333');
  // 尾巴
  px(ctx, 8, 2 + bounce - f, 1, 2, c1);
  // 腿
  px(ctx, 1, 6 + bounce, 2, 1, c1);
  px(ctx, 6, 6 + bounce, 2, 1, c1);
}

function drawEOctopus(ctx, bounce, state, f) {
  const c1 = '#ff2d78';
  const c2 = '#00f0ff';
  // 头
  px(ctx, 1, 0 + bounce, 6, 4, c1);
  // 眼睛
  px(ctx, 2, 1 + bounce, 2, 2, '#fff');
  px(ctx, 5, 1 + bounce, 2, 2, '#fff');
  px(ctx, 2, 2 + bounce, 1, 1, c2);
  px(ctx, 5, 2 + bounce, 1, 1, c2);
  // 触手
  const tOff = f === 0 ? 0 : 1;
  px(ctx, 0, 4 + bounce, 1, 3 + tOff, c1);
  px(ctx, 2, 4 + bounce, 1, 3 - tOff, c2);
  px(ctx, 4, 4 + bounce, 1, 3 + tOff, c1);
  px(ctx, 6, 4 + bounce, 1, 3 - tOff, c2);
  px(ctx, 7, 4 + bounce, 1, 3 + tOff, c1);
}

function drawGlowFox(ctx, bounce, state, f) {
  const c1 = '#ff6e27';
  const c2 = '#ff2d78';
  // 身体
  px(ctx, 1, 2 + bounce, 6, 4, c1);
  // 头
  px(ctx, 0, 0 + bounce, 7, 3, c1);
  // 尖耳
  px(ctx, 0, -1 + bounce, 1, 1, c2);
  px(ctx, 6, -1 + bounce, 1, 1, c2);
  // 眼睛
  px(ctx, 1, 1 + bounce, 2, 1, '#fff');
  px(ctx, 4, 1 + bounce, 2, 1, '#fff');
  // 鼻子
  px(ctx, 3, 2 + bounce, 1, 1, '#333');
  // 大尾巴
  px(ctx, 7, 1 + bounce + f, 2, 4, c1);
  px(ctx, 8, 0 + bounce + f, 1, 2, c2);
  // 腿
  px(ctx, 1, 6 + bounce, 2, 1, c1);
  px(ctx, 5, 6 + bounce, 2, 1, c1);
}

function drawMiniDragon(ctx, bounce, state, f) {
  const c1 = '#39ff14';
  const c2 = '#b829dd';
  // 身体
  px(ctx, 2, 2 + bounce, 5, 4, c1);
  // 头
  px(ctx, 1, 0 + bounce, 6, 3, c1);
  // 角
  px(ctx, 1, -1 + bounce, 1, 1, c2);
  px(ctx, 5, -1 + bounce, 1, 1, c2);
  // 眼睛
  px(ctx, 2, 1 + bounce, 1, 1, '#ff2d78');
  px(ctx, 5, 1 + bounce, 1, 1, '#ff2d78');
  // 翅膀
  const wingUp = f === 0;
  px(ctx, 0, wingUp ? 2 : 3, 2, wingUp ? 3 : 2, c2);
  px(ctx, 7, wingUp ? 2 : 3, 2, wingUp ? 3 : 2, c2);
  // 尾巴
  px(ctx, 7, 5 + bounce, 2, 1, c1);
  px(ctx, 9, 4 + bounce, 1, 1, c2);
  // 腿
  px(ctx, 2, 6 + bounce, 2, 1, c1);
  px(ctx, 5, 6 + bounce, 2, 1, c1);
}

/**
 * 绘制对话气泡
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} options
 */
export function drawBubble(ctx, { x, y, text, opacity }) {
  if (!text || opacity <= 0) return;

  ctx.save();
  ctx.globalAlpha = Math.min(1, opacity);

  const maxWidth = 160;
  ctx.font = '10px "Press Start 2P", monospace';

  // 测量文字
  const words = text.slice(0, 30); // 最多 30 字
  const metrics = ctx.measureText(words);
  const textWidth = Math.min(metrics.width, maxWidth);
  const padding = 8;
  const bubbleW = textWidth + padding * 2;
  const bubbleH = 22;
  const bx = Math.floor(x - bubbleW / 2);
  const by = Math.floor(y - bubbleH - 12);

  // 气泡背景
  ctx.fillStyle = 'rgba(26, 26, 46, 0.92)';
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
  ctx.lineWidth = 1;

  // 圆角矩形
  const r = 6;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bubbleW - r, by);
  ctx.quadraticCurveTo(bx + bubbleW, by, bx + bubbleW, by + r);
  ctx.lineTo(bx + bubbleW, by + bubbleH - r);
  ctx.quadraticCurveTo(bx + bubbleW, by + bubbleH, bx + bubbleW - r, by + bubbleH);
  // 小三角
  ctx.lineTo(bx + bubbleW / 2 + 5, by + bubbleH);
  ctx.lineTo(bx + bubbleW / 2, by + bubbleH + 6);
  ctx.lineTo(bx + bubbleW / 2 - 5, by + bubbleH);
  ctx.lineTo(bx + r, by + bubbleH);
  ctx.quadraticCurveTo(bx, by + bubbleH, bx, by + bubbleH - r);
  ctx.lineTo(bx, by + r);
  ctx.quadraticCurveTo(bx, by, bx + r, by);
  ctx.closePath();

  ctx.fill();
  ctx.stroke();

  // 气泡文字
  ctx.fillStyle = '#e0e0ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(words, Math.floor(x), by + bubbleH / 2);

  ctx.restore();
}

/**
 * 绘制 HP 条
 */
export function drawHPBar(ctx, { x, y, hp, maxHp }) {
  ctx.save();

  const barW = 40;
  const barH = 4;
  const bx = Math.floor(x - barW / 2);
  const by = Math.floor(y - 6);

  // 背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(bx, by, barW, barH);

  // HP 填充
  const ratio = hp / maxHp;
  const color = ratio > 0.5 ? '#39ff14' : ratio > 0.25 ? '#ff6e27' : '#ff2d78';
  ctx.fillStyle = color;
  ctx.fillRect(bx, by, barW * ratio, barH);

  // 边框
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, barW, barH);

  ctx.restore();
}

/**
 * 绘制用户名标签
 */
export function drawNameTag(ctx, { x, y, name, type }) {
  ctx.save();

  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  // Agent 用紫色，浏览器用蓝色
  ctx.fillStyle = type === 'agent' ? '#b829dd' : '#00f0ff';
  ctx.globalAlpha = 0.8;

  const icon = type === 'agent' ? '🤖' : '';
  ctx.fillText(`${icon}${name}`, Math.floor(x), Math.floor(y));

  ctx.restore();
}
