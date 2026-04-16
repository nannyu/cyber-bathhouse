/**
 * 澡堂场景渲染
 * 瓷砖墙壁、大池子、水面动画、蒸汽粒子、霓虹灯
 */

export class Bathhouse {
  constructor() {
    this._steamParticles = [];
    this._time = 0;

    // 初始化蒸汽粒子
    for (let i = 0; i < 30; i++) {
      this._steamParticles.push(this._createSteamParticle());
    }
  }

  _createSteamParticle() {
    return {
      x: 150 + Math.random() * 500,
      y: 180 + Math.random() * 40,
      size: 2 + Math.random() * 4,
      speed: 0.3 + Math.random() * 0.5,
      opacity: 0.1 + Math.random() * 0.3,
      drift: (Math.random() - 0.5) * 0.5,
    };
  }

  /**
   * 更新动画
   * @param {number} dt - 毫秒
   */
  update(dt) {
    this._time += dt;

    // 更新蒸汽粒子
    for (const p of this._steamParticles) {
      p.y -= p.speed;
      p.x += p.drift;
      p.opacity -= 0.001;

      if (p.y < 50 || p.opacity <= 0) {
        Object.assign(p, this._createSteamParticle());
      }
    }
  }

  /**
   * 渲染场景
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width - Canvas 宽
   * @param {number} height - Canvas 高
   * @param {Object} pool - 池子范围 {x, y, width, height}
   */
  render(ctx, width, height, pool) {
    this._renderBackground(ctx, width, height);
    this._renderPool(ctx, pool);
    this._renderNeonSigns(ctx, width);
    this._renderSteam(ctx);
  }

  _renderBackground(ctx, width, height) {
    // 深色背景
    ctx.fillStyle = '#0e1525';
    ctx.fillRect(0, 0, width, height);

    // 瓷砖网格
    const tileSize = 32;
    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        const isLight = ((x / tileSize) + (y / tileSize)) % 2 === 0;
        ctx.fillStyle = isLight ? '#1a2640' : '#152035';
        ctx.fillRect(x, y, tileSize, tileSize);

        // 瓷砖边缘
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.03)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    // 墙壁（上部）
    ctx.fillStyle = '#1a2a4a';
    ctx.fillRect(0, 0, width, 60);
    // 墙壁分割线
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 60);
    ctx.lineTo(width, 60);
    ctx.stroke();
  }

  _renderPool(ctx, pool) {
    if (!pool) return;

    const { x, y, width: pw, height: ph } = pool;

    // 池子边缘
    ctx.fillStyle = '#4a5a7b';
    ctx.fillRect(x - 8, y - 8, pw + 16, ph + 16);

    // 池子底部
    ctx.fillStyle = '#104a6a';
    ctx.fillRect(x, y, pw, ph);

    // 水面动画（正弦波）
    const time = this._time / 1000;
    ctx.fillStyle = '#1a6b8a';

    for (let wx = 0; wx < pw; wx += 4) {
      const waveY = Math.sin((wx + time * 60) * 0.03) * 3;
      ctx.fillRect(x + wx, y + waveY, 4, 4);
    }

    // 水面反光
    ctx.globalAlpha = 0.15;
    for (let wx = 0; wx < pw; wx += 20) {
      const sparkle = Math.sin((wx * 0.1 + time * 2)) > 0.7;
      if (sparkle) {
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(x + wx, y + 10 + Math.sin(time + wx) * 5, 3, 2);
      }
    }
    ctx.globalAlpha = 1;

    // 水面波纹层
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let row = 0; row < ph; row += 16) {
      ctx.beginPath();
      for (let wx = 0; wx < pw; wx += 2) {
        const wy = Math.sin((wx + time * 40 + row * 3) * 0.05) * 2;
        if (wx === 0) {
          ctx.moveTo(x + wx, y + row + wy);
        } else {
          ctx.lineTo(x + wx, y + row + wy);
        }
      }
      ctx.stroke();
    }
  }

  _renderNeonSigns(ctx, width) {
    const time = this._time / 1000;
    const flicker = Math.sin(time * 3) > -0.3;

    if (flicker) {
      ctx.save();
      ctx.font = '16px "Press Start 2P", monospace';
      ctx.textAlign = 'center';

      // 霓虹灯牌 — 赛博澡堂
      const glow = 0.6 + Math.sin(time * 2) * 0.2;
      ctx.globalAlpha = glow;
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 20;
      ctx.fillText('赛 博 澡 堂', width / 2, 38);

      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 侧面霓虹灯条
    ctx.save();
    const barGlow = 0.3 + Math.sin(time * 1.5) * 0.15;
    ctx.globalAlpha = barGlow;

    // 左侧
    ctx.fillStyle = '#ff2d78';
    ctx.fillRect(10, 70, 4, 100);
    ctx.fillStyle = '#b829dd';
    ctx.fillRect(10, 180, 4, 80);

    // 右侧
    ctx.fillStyle = '#b829dd';
    ctx.fillRect(width - 14, 70, 4, 80);
    ctx.fillStyle = '#ff2d78';
    ctx.fillRect(width - 14, 160, 4, 100);

    ctx.restore();
  }

  _renderSteam(ctx) {
    ctx.save();
    for (const p of this._steamParticles) {
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = 'rgba(200, 220, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
