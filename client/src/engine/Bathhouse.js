/**
 * 澡堂场景渲染
 * 瓷砖墙壁、大池子、水面动画、蒸汽粒子、霓虹灯
 */

export class Bathhouse {
  constructor() {
    this._steamParticles = [];
    this._time = 0;
    this._musicEnergy = 0.15;

    // 加载地图底图
    this._bgImage = new Image();
    this._bgImage.src = '/assets/map_bg.jpg';
    this._bgLoaded = false;
    this._bgImage.onload = () => {
      this._bgLoaded = true;
    };

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
    if (this._bgLoaded) {
      // 绘制用户提供的高清像素风底图
      ctx.drawImage(this._bgImage, 0, 0, width, height);
    } else {
      // 退化：绘制原有的基础几何图形背景
      this._renderBackground(ctx, width, height);
      if (zones && scrubBeds) {
        this._renderChangingArea(ctx, zones.CHANGING_AREA);
        this._renderVanityArea(ctx, zones.VANITY_AREA);
        this._renderShower(ctx, zones.SHOWER_AREA);
        this._renderSauna(ctx, zones.SAUNA_AREA);
        this._renderLounge(ctx, zones.LOUNGE_AREA);
        this._renderScrubArea(ctx, zones.SCRUB_AREA, scrubBeds);
        this._renderPool(ctx, zones.SMALL_POOL);
        this._renderArena(ctx, zones.ARENA);
      }
      this._renderPool(ctx, pool);
      this._renderNeonSigns(ctx, width);
    }
    
    // 蒸汽粒子仍保留在顶层，增加氛围感
    this._renderSteam(ctx);
  }

  _renderChangingArea(ctx, box) {
    if(!box) return;
    const {x, y, width, height} = box;
    // 木质地板背景 (稍微区分)
    ctx.fillStyle = '#a67342';
    ctx.fillRect(x, y, width, height);
    // 储物柜 (木质)
    ctx.fillStyle = '#7a4f27';
    ctx.strokeStyle = '#472b15';
    ctx.lineWidth = 2;
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 2; r++) {
         ctx.fillRect(x + 10 + c * 25, y + 10 + r * 40, 20, 35);
         ctx.strokeRect(x + 10 + c * 25, y + 10 + r * 40, 20, 35);
         // 柜门把手
         ctx.fillStyle = '#d69f69';
         ctx.fillRect(x + 25 + c * 25, y + 25 + r * 40, 2, 4);
         ctx.fillStyle = '#7a4f27';
      }
    }
  }

  _renderVanityArea(ctx, box) {
    if(!box) return;
    const {x, y, width, height} = box;
    ctx.fillStyle = '#c28d5c';
    ctx.fillRect(x, y, width, height);
    // 镜子
    ctx.fillStyle = '#e8f4f8';
    ctx.fillRect(x + 20, y + 10, width - 40, 30);
    ctx.strokeStyle = '#7a4f27';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 20, y + 10, width - 40, 30);
    // 暖色壁灯
    const time = this._time / 1000;
    const glow = 0.8 + Math.sin(time * 3) * 0.2;
    ctx.fillStyle = `rgba(255, 200, 100, ${glow})`;
    ctx.beginPath();
    ctx.arc(x + 10, y + 25, 4, 0, Math.PI * 2);
    ctx.arc(x + width - 10, y + 25, 4, 0, Math.PI * 2);
    ctx.fill();
    // 梳妆台木制桌面
    ctx.fillStyle = '#543417';
    ctx.fillRect(x + 10, y + 45, width - 20, 25);
    // 水池
    ctx.fillStyle = '#d69f69';
    ctx.fillRect(x + width/2 - 15, y + 48, 30, 15);
  }

  _renderShower(ctx, box) {
    if(!box) return;
    const {x, y, width, height} = box;
    // 浅色防滑瓷砖
    ctx.fillStyle = '#e0d6c8';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#c2b6a7';
    ctx.lineWidth = 1;
    for(let i=0; i<width; i+=20) {
       ctx.beginPath(); ctx.moveTo(x+i, y); ctx.lineTo(x+i, y+height); ctx.stroke();
    }
    for(let j=0; j<height; j+=20) {
       ctx.beginPath(); ctx.moveTo(x, y+j); ctx.lineTo(x+width, y+j); ctx.stroke();
    }

    // 淋浴莲蓬头与水流
    ctx.fillStyle = '#8a8a8a';
    for (let i = 0; i < 3; i++) {
       const headX = x + 15 + i * 30;
       ctx.fillRect(headX, y + 10, 10, 5);
       ctx.beginPath();
       ctx.moveTo(headX + 5, y + 15);
       ctx.lineTo(headX + 10, y + 25);
       ctx.stroke();

      // 下落水流线条
      ctx.strokeStyle = 'rgba(123, 181, 230, 0.6)';
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

      // 底部水花
      const splashW = 8 + this._musicEnergy * 18;
      ctx.fillStyle = `rgba(123, 181, 230, ${0.3 + this._musicEnergy * 0.25})`;
      ctx.fillRect(headX - 2, y + height - 12, splashW, 3);
    }
  }

  _renderSauna(ctx, box) {
    if(!box) return;
    const {x, y, width, height} = box;
    // 暖色木质桑拿房
    ctx.fillStyle = '#8f5c38';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#5c3a21';
    ctx.lineWidth = 2;
    for (let i=0; i<width; i+=20) {
      ctx.beginPath(); ctx.moveTo(x+i, y); ctx.lineTo(x+i, y+height); ctx.stroke();
    }
    // 木质长椅
    ctx.fillStyle = '#c28d5c';
    ctx.fillRect(x + 10, y + 20, width - 20, 30);
    ctx.fillRect(x + 10, y + 70, width - 20, 30);
    ctx.strokeRect(x + 10, y + 20, width - 20, 30);
    ctx.strokeRect(x + 10, y + 70, width - 20, 30);
    // 高温蒸汽泛黄/泛红效果
    ctx.fillStyle = 'rgba(255, 150, 50, 0.15)';
    ctx.fillRect(x, y, width, height);
    // 桑拿炉
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(x + width - 40, y + 10, 30, 30);
    const flicker = 0.5 + Math.sin(this._time / 100) * 0.5;
    ctx.fillStyle = `rgba(255, 60, 0, ${flicker})`;
    ctx.fillRect(x + width - 35, y + 25, 20, 10);
  }

  _renderLounge(ctx, box) {
    if(!box) return;
    const {x, y, width, height} = box;
    // 休息区地毯
    ctx.fillStyle = '#9eab8a';
    ctx.fillRect(x, y, width, height);
    // 木质边框
    ctx.strokeStyle = '#7a8c5f';
    ctx.lineWidth = 4;
    ctx.strokeRect(x+2, y+2, width-4, height-4);

    // 温馨躺椅
    ctx.fillStyle = '#d69f69';
    for(let i=0; i < 3; i++) {
        const cx = x + 20 + i * 40;
        const cy = y + 40;
        ctx.fillRect(cx, cy, 25, 50);
        // 靠垫
        ctx.fillStyle = '#fff9f0';
        ctx.fillRect(cx + 5, cy - 10, 15, 15);
        ctx.fillStyle = '#d69f69';
    }
    
    // 盆栽
    ctx.fillStyle = '#4a7c3b';
    ctx.beginPath();
    ctx.arc(x + width - 15, y + 15, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8c5936';
    ctx.fillRect(x + width - 20, y + 15, 10, 10);
  }

  _renderScrubArea(ctx, box, scrubBeds) {
    if(!box || !scrubBeds) return;
    const {x, y, width, height} = box;
    // 区域底色与框 (浅色木板)
    ctx.fillStyle = '#d6ad81';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#a67342';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // 搓澡床
    for (const bed of scrubBeds) {
      const b = bed.box;
      // 阴影
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(b.x + 2, b.y + 2, b.width, b.height);
      // 床体 (木质)
      ctx.fillStyle = '#8f5c38';
      ctx.fillRect(b.x, b.y, b.width, b.height);
      ctx.strokeStyle = '#5c3a21';
      ctx.strokeRect(b.x, b.y, b.width, b.height);
      // 毛巾垫
      ctx.fillStyle = '#f5ecd9';
      ctx.fillRect(b.x + 5, b.y + 5, b.width - 10, b.height - 10);
      // 枕头
      ctx.fillStyle = '#e0d6c8';
      ctx.fillRect(b.x + 10, b.y + 15, 15, b.height - 30);
    }
  }

  _renderArena(ctx, box) {
    if(!box) return;
    const {x, y, width, height} = box;
    
    // 擂台边缘阴影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 4, y + 4, width, height);
    
    // 擂台垫子地板
    ctx.fillStyle = '#e8dec3';
    ctx.fillRect(x, y, width, height);
    
    // 缝线细节
    ctx.strokeStyle = '#d4c7a3';
    ctx.lineWidth = 2;
    for (let i = 20; i < width; i += 40) {
      ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + height); ctx.stroke();
    }
    
    // 边界红色警戒线
    ctx.strokeStyle = '#c94040';
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 10, y + 10, width - 20, height - 20);

    // 擂台四角柱子 (红/蓝)
    const drawPost = (px, py, color) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
    };
    drawPost(x + 10, y + 10, '#c94040');
    drawPost(x + width - 10, y + 10, '#c94040');
    drawPost(x + 10, y + height - 10, '#4a5a7b');
    drawPost(x + width - 10, y + height - 10, '#4a5a7b');

    // 中央徽标
    ctx.fillStyle = 'rgba(166, 115, 66, 0.15)';
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height / 2, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(166, 115, 66, 0.2)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height / 2, 45, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(166, 115, 66, 0.3)';
    ctx.font = 'bold 36px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('汤', x + width / 2, y + height / 2);
  }

  _renderBackground(ctx, width, height) {
    // 星露谷木质地板
    ctx.fillStyle = '#a67342';
    ctx.fillRect(0, 0, width, height);

    // 木板纹理
    const tileSize = 40;
    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        const isDark = ((x / tileSize) + (y / tileSize)) % 2 === 0;
        ctx.fillStyle = isDark ? '#b37f4d' : '#9c6b3b';
        ctx.fillRect(x, y, tileSize, tileSize);

        // 木板边缘线条
        ctx.strokeStyle = '#7a4f27';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + tileSize, y);
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + tileSize);
        ctx.stroke();
      }
    }

    // 墙壁（上部木墙板）
    ctx.fillStyle = '#8f5c38';
    ctx.fillRect(0, 0, width, 60);
    for(let x=0; x < width; x+=30) {
      ctx.strokeStyle = '#5c3a21';
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 60); ctx.stroke();
    }
    // 墙裙线
    ctx.fillStyle = '#5c3a21';
    ctx.fillRect(0, 56, width, 4);
  }

  _renderPool(ctx, pool) {
    if (!pool) return;

    const { x, y, width: pw, height: ph } = pool;

    // 大理石包边
    ctx.fillStyle = '#f5ecd9';
    ctx.fillRect(x - 12, y - 12, pw + 24, ph + 24);
    
    // 大理石瓷砖纹理
    ctx.strokeStyle = '#e0d6c8';
    ctx.lineWidth = 2;
    for (let bx = x - 12; bx < x + pw + 12; bx += 20) {
      ctx.beginPath(); ctx.moveTo(bx, y - 12); ctx.lineTo(bx, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, y + ph); ctx.lineTo(bx, y + ph + 12); ctx.stroke();
    }
    for (let by = y - 12; by < y + ph + 12; by += 20) {
      ctx.beginPath(); ctx.moveTo(x - 12, by); ctx.lineTo(x, by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + pw, by); ctx.lineTo(x + pw + 12, by); ctx.stroke();
    }
    
    // 池子内壁边缘阴影
    ctx.fillStyle = '#d0b89f';
    ctx.fillRect(x, y, pw, 4);
    ctx.fillRect(x, y, 4, ph);

    // 池子清澈的蓝水底色
    ctx.fillStyle = 'rgba(100, 180, 220, 0.85)';
    ctx.fillRect(x, y, pw, ph);

    // 水面动画（波光）
    const time = this._time / 1000;
    ctx.fillStyle = 'rgba(150, 210, 240, 0.6)';

    for (let wx = 0; wx < pw; wx += 6) {
      const waveY = Math.sin((wx + time * 40) * 0.04) * 4;
      ctx.fillRect(x + wx, y + waveY + 10, 5, 3);
    }

    // 水面闪烁反光
    ctx.globalAlpha = 0.4;
    for (let wx = 0; wx < pw; wx += 24) {
      const sparkle = Math.sin((wx * 0.15 + time * 1.5)) > 0.8;
      if (sparkle) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + wx, y + 20 + Math.sin(time + wx) * 8, 4, 2);
      }
    }
    ctx.globalAlpha = 1;

    // 水面波纹层
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let row = 0; row < ph; row += 20) {
      ctx.beginPath();
      for (let wx = 0; wx < pw; wx += 4) {
        const wy = Math.sin((wx + time * 30 + row * 2) * 0.06) * 3;
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
    
    // 替换为温馨的木制招牌
    ctx.save();
    ctx.font = 'bold 16px "Press Start 2P", monospace';
    ctx.textAlign = 'center';

    // 招牌木板
    ctx.fillStyle = '#7a4f27';
    ctx.fillRect(width / 2 - 80, 15, 160, 30);
    ctx.strokeStyle = '#472b15';
    ctx.lineWidth = 2;
    ctx.strokeRect(width / 2 - 80, 15, 160, 30);

    // 招牌文字
    ctx.fillStyle = '#f5ecd9';
    ctx.fillText('星 露 澡 堂', width / 2, 36);
    ctx.restore();

    // 替换侧边霓虹灯为壁挂火炬
    ctx.save();
    for (let y = 100; y <= 200; y += 100) {
      // 左侧火炬
      ctx.fillStyle = '#472b15'; // 支架
      ctx.fillRect(10, y, 6, 15);
      // 火焰闪烁
      const flicker = 0.7 + Math.sin(time * 8 + y) * 0.3;
      ctx.globalAlpha = flicker;
      ctx.fillStyle = '#ff9900';
      ctx.beginPath(); ctx.arc(13, y - 5, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath(); ctx.arc(13, y - 5, 4, 0, Math.PI * 2); ctx.fill();

      // 右侧火炬
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#472b15';
      ctx.fillRect(width - 16, y, 6, 15);
      const flicker2 = 0.7 + Math.sin(time * 7 + y) * 0.3;
      ctx.globalAlpha = flicker2;
      ctx.fillStyle = '#ff9900';
      ctx.beginPath(); ctx.arc(width - 13, y - 5, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath(); ctx.arc(width - 13, y - 5, 4, 0, Math.PI * 2); ctx.fill();
    }
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
