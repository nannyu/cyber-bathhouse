/**
 * 像素精灵渲染工具
 * 通过代码生成像素角色和宠物（不依赖外部图片）
 */
import { getSpriteAtlas } from './SpriteAtlas.js';
import { drawCharacterFromCode } from './SkillPoses.js';

const PIXEL = 4; // 1 逻辑像素 = 4 屏幕像素

/** 战败倒地总时长、首帧过渡 —— 与 Game.handleFightEnded 使用同一数值 */
export const KO_DOWN_DURATION_MS = 1800;
export const KO_DOWN_FIRST_FRAME_MS = 260;

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
  const spriteId = arguments[1]?.spriteId;
  const actionState = arguments[1]?.actionState;
  const currentSkillId = arguments[1]?.currentSkillId;
  const phase = arguments[1]?.phase;
  const phaseFrame = arguments[1]?.phaseFrame || 0;
  const facing = arguments[1]?.facing ?? (direction === 3 ? -1 : 1);
  const knockdownElapsedMs = arguments[1]?.knockdownElapsedMs;
  const atlas = getSpriteAtlas();
  // 搓澡状态使用 knockdown 动画（趴在床上）
  const animKey = state === 'scrubbing'
    ? 'knockdown'
    : (currentSkillId || actionState || (state === 'walking' ? 'walk' : 'idle'));

  if (spriteId && atlas.isReady(spriteId)) {
    const charDef = atlas.manifest?.characters?.[spriteId];
    // 如果动画不存在于精灵表中且是自定义动画，跳过精灵表走代码路径
    const hasAnim = charDef?.animations?.[animKey];
    if (!hasAnim && animKey === 'npc_scrubbing') {
      // 跳过精灵表，走下面的代码像素动画路径
    } else {
      const anim = hasAnim || charDef?.animations?.idle;
      const fps = anim?.fps || 8;
      const nf = anim?.frames || 1;
      let frameIdx = phaseFrame > 0 ? Math.floor((phaseFrame * fps) / 20) : (frame % nf);
      if (animKey === 'knockdown') {
        if (knockdownElapsedMs != null) {
          frameIdx = knockdownElapsedMs < KO_DOWN_FIRST_FRAME_MS ? 0 : nf - 1;
        } else if (state === 'scrubbing') {
          // 搓澡时固定使用倒地最后一帧（趴平）
          frameIdx = nf - 1;
        }
      }
      // 不同精灵表的原生朝向不同（brawler→右、punk→左），按 manifest 决定何时镜像。
      const native = charDef?.nativeFacing === 'left' ? -1 : 1;
      const flipX = facing !== native;

      // 搓澡/战败状态：在精灵表绘制前应用变换
      if (state === 'scrubbing' || state === 'defeated') {
        ctx.save();
        ctx.translate(x + 24, y + 32);
        // 搓澡时轻微抖动
        if (state === 'scrubbing') {
          const scrubShake = Math.sin(Date.now() * 0.01) * 1.5;
          ctx.translate(scrubShake, 0);
        }
        const drawn = atlas.drawFrame(ctx, spriteId, animKey, frameIdx, 0, 0, { flipX });
        ctx.restore();
        if (drawn) return;
      }

      const drawn = atlas.drawFrame(ctx, spriteId, animKey, frameIdx, x + 24, y + 32, {
        flipX,
      });
      if (drawn) return;
    }
  }

  if (state === 'fighting' || actionState || currentSkillId) {
    drawCharacterFromCode(ctx, {
      x,
      y,
      palette,
      actionState: actionState || state,
      currentSkillId,
      phase,
      phaseFrame,
      frame,
      facing,
    });
    return;
  }

  ctx.save();
  ctx.translate(Math.floor(x), Math.floor(y));

  if (state === 'scrubbing' || state === 'defeated') {
    ctx.translate(30, 32);
    if (state === 'scrubbing') {
      // 搓澡时轻微抖动，不旋转
      const scrubShake = Math.sin(Date.now() * 0.01) * 1.5;
      ctx.translate(scrubShake, 0);
    }
    ctx.translate(-30, -32);
  }

  if (state === 'victory') {
    ctx.translate(0, frame % 4 < 2 ? -6 : 0);
  }

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

  // 战斗状态 — 大幅度出拳 + 身体晃动
  if (state === 'fighting') {
    const fightPhase = frame % 4;
    // 身体前后晃动
    const lungeX = fightPhase === 0 ? 4 : (fightPhase === 2 ? -3 : 0);
    const lungeY = fightPhase === 1 ? -3 : 0;
    ctx.translate(lungeX, lungeY);

    // 交替出拳（phase 0 右拳，phase 2 左拳）
    const isRightPunch = fightPhase === 0 || fightPhase === 1;
    const isLeftPunch = fightPhase === 2 || fightPhase === 3;
    const punchOffset = isRightPunch ? 1 : 0;

    if (isRightPunch) {
      // 右拳伸出
      px(ctx, 11, 6 + bounce, 5, 4, skin);
      px(ctx, 16, 5 + bounce, 3, 2, '#ff2d78');
      px(ctx, 17, 7 + bounce, 2, 2, '#ff6e27');
    }
    if (isLeftPunch) {
      // 左拳伸出
      px(ctx, -4, 6 + bounce, 5, 4, skin);
      px(ctx, -6, 5 + bounce, 3, 2, '#ff2d78');
      px(ctx, -7, 7 + bounce, 2, 2, '#ff6e27');
    }

    // 身体倾斜残影
    if (fightPhase === 1 || fightPhase === 3) {
      px(ctx, isRightPunch ? 0 : 9, 9 + bounce, 2, 3, 'rgba(0,240,255,0.25)');
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
    case 'rainbow_pony':
      drawRainbowPony(ctx, bounce, state, f);
      break;
    case 'cyber_pig':
      drawCyberPig(ctx, bounce, state, f);
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

function drawRainbowPony(ctx, bounce, state, f) {
  const body = '#f5e6ff';
  const outline = '#b829dd';
  const horn = '#00f0ff';
  const r1 = '#ff2d78';
  const r2 = '#ff6e27';
  const r3 = '#39ff14';
  const r4 = '#00f0ff';
  const maneShift = f === 0 ? 0 : 1;
  // 身体
  px(ctx, 1, 3 + bounce, 7, 3, body);
  px(ctx, 1, 3 + bounce, 7, 1, outline);
  // 鬃毛（彩虹条）
  px(ctx, 0, 0 + bounce + maneShift, 1, 4, r1);
  px(ctx, 1, -1 + bounce + maneShift, 1, 3, r2);
  px(ctx, 2, -2 + bounce + maneShift, 2, 2, r3);
  px(ctx, 4, -1 + bounce + maneShift, 2, 2, r4);
  // 头
  px(ctx, 5, 1 + bounce, 4, 3, body);
  px(ctx, 5, 1 + bounce, 4, 1, outline);
  // 独角
  px(ctx, 8, -1 + bounce, 1, 2, horn);
  // 眼睛
  px(ctx, 6, 2 + bounce, 1, 1, '#111');
  px(ctx, 7, 2 + bounce, 1, 1, '#ff2d78');
  // 尾巴（彩虹）
  px(ctx, 0, 4 + bounce - f, 1, 2, r2);
  px(ctx, -1, 3 + bounce - f, 1, 2, r4);
  // 腿
  px(ctx, 2, 6 + bounce, 2, 1, body);
  px(ctx, 6, 6 + bounce, 2, 1, body);
}

function drawCyberPig(ctx, bounce, state, f) {
  const pink = '#ff9ec8';
  const dark = '#ff2d78';
  const circuit = '#00f0ff';
  const snout = '#ffc2dc';
  const cheek = '#ffb3d3';
  // 猪头主体（强调脸部轮廓）
  px(ctx, 1, 1 + bounce, 7, 5, pink);
  px(ctx, 1, 1 + bounce, 7, 1, dark);
  // 耳朵
  px(ctx, 2, 0 + bounce, 1, 1, dark);
  px(ctx, 6, 0 + bounce, 1, 1, dark);
  // 脸颊
  px(ctx, 1, 3 + bounce, 1, 2, cheek);
  px(ctx, 7, 3 + bounce, 1, 2, cheek);
  // 眼睛
  px(ctx, 3, 2 + bounce, 1, 1, '#111');
  px(ctx, 5, 2 + bounce, 1, 1, '#111');
  // 猪鼻（居中）
  px(ctx, 3, 4 + bounce, 3, 2, snout);
  px(ctx, 4, 4 + bounce, 1, 2, dark);
  px(ctx, 3, 5 + bounce, 1, 1, '#333');
  px(ctx, 5, 5 + bounce, 1, 1, '#333');
  // 赛博发光纹路
  const blink = f === 0 ? 0 : 1;
  px(ctx, 0, 3 + bounce, 1, 1, circuit);
  px(ctx, 8, 2 + bounce + blink, 1, 1, circuit);
  // 下巴与短腿
  px(ctx, 2, 6 + bounce, 5, 1, pink);
  px(ctx, 2, 7 + bounce, 1, 1, pink);
  px(ctx, 6, 7 + bounce, 1, 1, pink);
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
export function drawNameTag(ctx, { x, y, name, type, isNpc }) {
  ctx.save();

  const fontSize = 8;
  ctx.font = `bold ${fontSize}px "Press Start 2P", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const icon = type === 'agent' ? '🤖' : '';
  const displayText = `${icon}${name}`;

  // 测量文字宽度用于背景气泡
  const textWidth = ctx.measureText(displayText).width;
  const padX = 4;
  const padY = 3;
  const bgX = Math.floor(x) - textWidth / 2 - padX;
  const bgY = Math.floor(y) - fontSize - padY;
  const bgW = textWidth + padX * 2;
  const bgH = fontSize + padY * 2;

  // 半透明背景气泡
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(bgX, bgY, bgW, bgH);

  // 文字颜色：NPC 用金色，Agent 用紫色，玩家用白色
  if (isNpc) {
    ctx.fillStyle = '#ffd700';
  } else if (type === 'agent') {
    ctx.fillStyle = '#c084fc';
  } else {
    ctx.fillStyle = '#ffffff';
  }

  ctx.fillText(displayText, Math.floor(x), Math.floor(y));

  ctx.restore();
}
