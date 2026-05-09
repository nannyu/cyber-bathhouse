const PIXEL = 4;

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * PIXEL, y * PIXEL, w * PIXEL, h * PIXEL);
}

export function drawCharacterFromCode(ctx, opts) {
  const { x, y, palette, actionState, currentSkillId, phase, frame, phaseFrame, facing = 1 } = opts;
  ctx.save();
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  ctx.translate(fx, fy);
  const pivotX = 24;
  const pivotY = 32;
  ctx.translate(pivotX, pivotY);
  if (facing < 0) {
    ctx.scale(-1, 1);
  }
  ctx.translate(-pivotX, -pivotY);

  // 蹲下/跳跃变换（在绘制身体之前应用）
  if (actionState === 'crouch') {
    ctx.translate(0, 8);
    ctx.scale(1, 0.65);
  }
  if (actionState === 'jump' || actionState === 'jump_attack') {
    const jumpOffset = Math.sin((phaseFrame || frame) * 0.5) * 8;
    ctx.translate(0, -14 - jumpOffset);
  }
  if (actionState === 'knockdown') {
    // 使用倒地帧，不旋转
    ctx.translate(0, 8);
  }

  const bounce = frame % 2 === 0 ? 0 : -1;
  const walkOffset = actionState === 'walk' ? (frame % 4 < 2 ? 1 : -1) : 0;
  const bodyShift = actionState === 'hitstun' ? (frame % 2 === 0 ? -1 : 1) : 0;
  const { hair, skin, shorts } = palette;

  // Base body
  px(ctx, 2 + bodyShift, bounce, 8, 3, hair);
  px(ctx, 2 + bodyShift, bounce + 3, 8, 4, skin);
  px(ctx, 3 + bodyShift, 7, 6, 4, skin);
  px(ctx, 3 + bodyShift, 11, 6, 2, shorts);
  px(ctx, 3 + bodyShift, 13, 2, 3 + walkOffset, skin);
  px(ctx, 7 + bodyShift, 13, 2, 3 - walkOffset, skin);

  // Skill / phase overlays
  const fxColor = currentSkillId === 'heavy_strike' ? '#ff6e27' : '#00f0ff';
  if (phase === 'startup') {
    px(ctx, 10 + bodyShift, 8, 2, 2, fxColor);
  } else if (phase === 'active') {
    const reach = currentSkillId === 'heavy_strike' ? 8 : 5;
    px(ctx, 10 + bodyShift, 7, reach, 3, fxColor);
    if (currentSkillId === 'parry') {
      px(ctx, 1 + bodyShift, 7, 2, 4, '#ffe66d');
    }
  } else if (phase === 'recovery') {
    px(ctx, 9 + bodyShift, 9, 2, 2, '#7be5ff');
  }

  if (actionState === 'guard' || actionState === 'blockstun') {
    px(ctx, 1 + bodyShift, 8, 2, 4, '#7be5ff');
  }
  if (phaseFrame > 0 && currentSkillId === 'dash') {
    px(ctx, -1 + bodyShift, 9, 2, 3, 'rgba(0,240,255,0.35)');
  }
  if (currentSkillId === 'crouch_kick') {
    px(ctx, 8 + bodyShift, 14, 6, 2, '#ff6e27');
  }
  if (currentSkillId === 'jump_kick') {
    px(ctx, 8 + bodyShift, 5, 5, 3, '#00f0ff');
  }

  // 王师傅搓澡动画：手臂前后搓动 + 身体抖动
  if (actionState === 'npc_scrubbing') {
    const scrubFrame = Math.floor(Date.now() / 200) % 4; // 5fps 搓动循环
    const armX = scrubFrame < 2 ? 10 : 8; // 手臂前后位移
    const armY = scrubFrame % 2 === 0 ? 7 : 8; // 上下微动
    // 身体抖动
    const shakeX = Math.sin(Date.now() * 0.015) * 0.4;
    const shakeY = Math.cos(Date.now() * 0.012) * 0.3;
    ctx.translate(shakeX * PIXEL, shakeY * PIXEL);
    // 伸出的搓澡手臂
    px(ctx, armX, armY, 4, 2, skin);
    // 搓澡巾（白色毛巾）
    px(ctx, armX + 2, armY + 1, 3, 1, '#f5f0e0');
    // 搓出的水花/泡沫
    if (scrubFrame === 0 || scrubFrame === 2) {
      px(ctx, armX + 4, armY - 1, 1, 1, '#aee8ff');
      px(ctx, armX + 3, armY + 2, 1, 1, '#aee8ff');
    }
    if (scrubFrame === 1) {
      px(ctx, armX + 5, armY, 1, 1, '#fff');
    }
  }

  ctx.restore();
}

