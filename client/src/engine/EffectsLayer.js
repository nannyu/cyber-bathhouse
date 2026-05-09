export class EffectsLayer {
  constructor() {
    this.hitSparks = [];
    this.afterImages = [];
    this.projectileTrails = [];
    this.scrubParticles = [];
  }

  addHitSpark(x, y, kind = 'small') {
    const life = kind === 'cinematic' ? 400 : 220;
    const size = kind === 'large' ? 18 : kind === 'cinematic' ? 26 : 12;
    this.hitSparks.push({ x, y, life, maxLife: life, size });
  }

  addAfterImage(x, y) {
    this.afterImages.push({ x, y, life: 180 });
  }

  addProjectileTrail(x, y) {
    this.projectileTrails.push({ x, y, life: 140 });
  }

  /**
   * 添加搓澡粒子效果（水花/泡泡/蒸汽）
   */
  addScrubParticle(x, y) {
    const types = ['bubble', 'steam', 'sparkle'];
    const type = types[Math.floor(Math.random() * types.length)];
    this.scrubParticles.push({
      x: x + (Math.random() - 0.5) * 40,
      y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -Math.random() * 2 - 0.5,
      life: 600 + Math.random() * 400,
      maxLife: 1000,
      size: 3 + Math.random() * 4,
      type,
    });
  }

  update(dt) {
    const step = (arr) => {
      for (let i = arr.length - 1; i >= 0; i -= 1) {
        arr[i].life -= dt;
        if (arr[i].life <= 0) arr.splice(i, 1);
      }
    };
    step(this.hitSparks);
    step(this.afterImages);
    step(this.projectileTrails);

    // 搓澡粒子需要移动
    for (let i = this.scrubParticles.length - 1; i >= 0; i -= 1) {
      const p = this.scrubParticles[i];
      p.life -= dt;
      p.x += p.vx;
      p.y += p.vy;
      if (p.life <= 0) this.scrubParticles.splice(i, 1);
    }
  }

  render(ctx) {
    ctx.save();
    for (const s of this.afterImages) {
      ctx.globalAlpha = Math.max(0, s.life / 180) * 0.35;
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(s.x - 10, s.y - 40, 20, 40);
    }

    for (const p of this.projectileTrails) {
      ctx.globalAlpha = Math.max(0, p.life / 140) * 0.45;
      ctx.fillStyle = '#b829dd';
      ctx.fillRect(p.x - 8, p.y - 8, 12, 12);
    }

    for (const h of this.hitSparks) {
      ctx.globalAlpha = Math.max(0, h.life / h.maxLife);
      ctx.fillStyle = '#ffe66d';
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.size * (h.life / h.maxLife), 0, Math.PI * 2);
      ctx.fill();
    }

    // 搓澡粒子
    for (const p of this.scrubParticles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      if (p.type === 'bubble') {
        ctx.strokeStyle = 'rgba(173, 216, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(200, 235, 255, 0.3)';
        ctx.fill();
      } else if (p.type === 'steam') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // sparkle — 十字星
        ctx.fillStyle = '#ffe66d';
        const s = p.size * 0.8;
        ctx.fillRect(p.x - s / 2, p.y - 0.5, s, 1);
        ctx.fillRect(p.x - 0.5, p.y - s / 2, 1, s);
      }
    }

    ctx.restore();
  }
}

