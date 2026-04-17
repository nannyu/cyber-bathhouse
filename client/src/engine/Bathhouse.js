/**
 * 澡堂场景渲染
 * 瓷砖墙壁、大池子、水面动画、蒸汽粒子、霓虹灯
 */

export class Bathhouse {
  constructor() {
    this._steamParticles = [];
    this._time = 0;
    this._musicEnergy = 0.15;

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
    this._musicEnergy = Math.max(0.08, this._musicEnergy * 0.95);

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
   * 注入音乐能量（0~1），用于水流波形联动
   * @param {number} value
   */
  setMusicEnergy(value) {
    const clamped = Math.max(0, Math.min(1, value || 0));
    this._musicEnergy = Math.max(this._musicEnergy, clamped);
  }

  /**
   * 渲染场景
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width - Canvas 宽
   * @param {number} height - Canvas 高
   * @param {Object} pool - 池子范围 {x, y, width, height}
   * @param {Object} zones - 特殊区域字典
   * @param {Array} scrubBeds - 搓澡床数组
   */
  render(ctx, width, height, pool, zones, scrubBeds) {
    this._renderBackground(ctx, width, height);
    if (zones && scrubBeds) {
      this._renderChangingArea(ctx, zones.CHANGING_AREA);
      this._renderVanityArea(ctx, zones.VANITY_AREA);
      this._renderShower(ctx, zones.SHOWER_AREA);
      this._renderSauna(ctx, zones.SAUNA_AREA);
      this._renderLounge(ctx, zones.LOUNGE_AREA);
      this._renderScrubArea(ctx, zones.SCRUB_AREA, scrubBeds);
    }
    this._renderPool(ctx, pool);
    this._renderNeonSigns(ctx, width);
    this._renderSteam(ctx);
  }

  _renderChangingArea(ctx, box) {
    if(!box) return;
    const {x, y, width, height} = box;
    ctx.fillStyle = '#1c2230';
    ctx.fillRect(x, y, width, height);
    // 储物柜
    ctx.fillStyle = '#2a344a';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1;
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 2; r++) {
         ctx.fillRect(x + 10 + c * 25, y + 10 + r * 40, 20, 35);
         ctx.globalAlpha = 0.3;
         ctx.strokeRect(x + 10 + c * 25, y + 10 + r * 40, 20, 35);
         ctx.globalAlpha = 1;
      }
    }
  }

  _renderVanityArea(ctx, box) {
    if(!box) return;
    const {x, y, width, height} = box;
    ctx.fillStyle = '#221a2a';
    ctx.fillRect(x, y, width, height);
    // 镜子
    ctx.fillStyle = '#bcd4e6';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x + 20, y + 10, width - 40, 30);
    ctx.globalAlpha = 1;
    // 霓虹跑马灯
    const time = this._time / 1000;
    const blink = Math.sin(time * 5) > 0 ? '#ff2d78' : '#00f0ff';
    ctx.fillStyle = blink;
    ctx.fillRect(x + 15, y + 15, 5, 5);
    ctx.fillRect(x + width - 20, y + 15, 5, 5);
    // 梳妆台桌面
    ctx.fillStyle = '#4a2530';
    ctx.fillRect(x + 10, y + 45, width - 20, 25);
  }

  _renderShower(ctx, box) {
    if(!box) return;
    const {x, y, width, height} = box;
    ctx.fillStyle = '#102025';
    ctx.fillRect(x, y, width, height);
    // 淋浴莲蓬头与水流
    ctx.fillStyle = '#7a8c99';
    for (let i = 0; i < 3; i++) {
       const headX = x + 15 + i * 30;
       ctx.fillRect(headX, y + 10, 10, 5);
       ctx.beginPath();
       ctx.moveTo(headX + 5, y + 15);
       ctx.lineTo(headX + 10, y + 25);
       ctx.stroke();

      // 下落水流线条（根据音乐旋律能量产生 wave 起伏）
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 1;
      const dropOffset = (this._time / 10 + i * 20) % 20;
      const amp = 2 + this._musicEnergy * 10;
      for (let d = 0; d < 4; d++) {
        const baseX = headX + d * 3;
        ctx.beginPath();
        for (let sy = y + 25 + dropOffset; sy <= y + height - 10; sy += 4) {
          const phase = (sy * 0.13) + (this._time * 0.012) + i * 0.9 + d * 0.6;
          const wx = baseX + Math.sin(phase) * amp;
          if (sy === y + 25 + dropOffset) ctx.moveTo(wx, sy);
          else ctx.lineTo(wx, sy);
        }
        ctx.stroke();
      }

      // 底部水花随音乐脉动
      const splashW = 8 + this._musicEnergy * 18;
      ctx.fillStyle = `rgba(0, 240, 255, ${0.1 + this._musicEnergy * 0.25})`;
      ctx.fillRect(headX - 2, y + height - 12, splashW, 3);
    }
  }

  _renderSauna(ctx, box) {
    if(!box) return;
    const {x, y, width, height} = box;
    // 木质地板
    ctx.fillStyle = '#4a2511';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#2a1100';
    for (let i=0; i<width; i+=20) {
      ctx.beginPath(); ctx.moveTo(x+i, y); ctx.lineTo(x+i, y+height); ctx.stroke();
    }
    // 木质长椅
    ctx.fillStyle = '#663318';
    ctx.fillRect(x + 10, y + 20, width - 20, 30);
    ctx.fillRect(x + 10, y + 70, width - 20, 30);
    // 高温蒸汽泛红效果
    ctx.fillStyle = 'rgba(255, 60, 0, 0.2)';
    ctx.fillRect(x, y, width, height);
  }

  _renderLounge(ctx, box) {
    if(!box) return;
    const {x, y, width, height} = box;
    ctx.fillStyle = 'rgba(30, 40, 60, 0.5)';
    ctx.fillRect(x, y, width, height);
    // 全息机械躺椅
    ctx.fillStyle = '#39ff14';
    ctx.globalAlpha = 0.6;
    for(let i=0; i < 3; i++) {
        const cx = x + 20 + i * 40;
        const cy = y + 40;
        ctx.fillRect(cx, cy, 25, 50);
        ctx.fillStyle = '#ff2d78';
        ctx.fillRect(cx + 5, cy - 10, 15, 15);
        ctx.fillStyle = '#39ff14';
    }
    ctx.globalAlpha = 1;
  }

  _renderScrubArea(ctx, box, scrubBeds) {
    if(!box || !scrubBeds) return;
    const {x, y, width, height} = box;
    // 区域底色与框
    ctx.fillStyle = '#152b3c';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.strokeRect(x, y, width, height);

    // 搓澡床
    for (const bed of scrubBeds) {
      const b = bed.box;
      // 阴影
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(b.x + 2, b.y + 2, b.width, b.height);
      // 床体
      ctx.fillStyle = '#c5d0e6';
      ctx.fillRect(b.x, b.y, b.width, b.height);
      // 枕头
      ctx.fillStyle = '#8ca2cc';
      ctx.fillRect(b.x + 10, b.y + 15, 15, b.height - 30);
    }
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

    // 池子底部 (透明度 85%)
    ctx.fillStyle = 'rgba(16, 74, 106, 0.85)';
    ctx.fillRect(x, y, pw, ph);

    // 水面动画（正弦波）
    const time = this._time / 1000;
    ctx.fillStyle = 'rgba(26, 107, 138, 0.85)';

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
