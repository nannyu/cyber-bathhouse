export class EffectsLayer {
  constructor() {
    this.hitSparks = [];
    this.afterImages = [];
    this.projectileTrails = [];
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
    ctx.restore();
  }
}

