class SpriteAtlas {
  constructor() {
    this.manifest = null;
    this.images = new Map();
  }

  async loadManifest() {
    if (this.manifest) return this.manifest;
    try {
      const res = await fetch('/sprites/manifest.json');
      if (!res.ok) return null;
      this.manifest = await res.json();
      return this.manifest;
    } catch {
      return null;
    }
  }

  async preload(spriteId) {
    const manifest = await this.loadManifest();
    const charDef = manifest?.characters?.[spriteId];
    if (!charDef) return false;
    const jobs = Object.values(charDef.animations || {}).map((anim) =>
      this._loadImage(`/sprites/${spriteId}/${anim.src}`),
    );
    await Promise.all(jobs);
    return true;
  }

  isReady(spriteId) {
    const charDef = this.manifest?.characters?.[spriteId];
    if (!charDef) return false;
    return Object.values(charDef.animations || {}).every((anim) =>
      this.images.has(`/sprites/${spriteId}/${anim.src}`),
    );
  }

  drawFrame(ctx, spriteId, animKey, frameIdx, x, y, options = {}) {
    const charDef = this.manifest?.characters?.[spriteId];
    if (!charDef) return false;
    const anim = charDef.animations?.[animKey] || charDef.animations?.idle;
    if (!anim) return false;
    const url = `/sprites/${spriteId}/${anim.src}`;
    const img = this.images.get(url);
    if (!img) return false;

    const frameWidth = charDef.frameWidth;
    const frameHeight = charDef.frameHeight;
    const frame = Math.max(0, Math.min((anim.frames || 1) - 1, frameIdx || 0));
    const sx = frame * frameWidth;
    const sy = 0;
    const anchorX = charDef.anchor?.x ?? Math.floor(frameWidth / 2);
    const anchorY = charDef.anchor?.y ?? frameHeight;
    const drawX = Math.round(x - anchorX);
    const drawY = Math.round(y - anchorY);

    ctx.save();
    if (options.flipX) {
      ctx.translate(Math.round(x), 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, frameWidth, frameHeight, -anchorX, drawY, frameWidth, frameHeight);
    } else {
      ctx.drawImage(img, sx, sy, frameWidth, frameHeight, drawX, drawY, frameWidth, frameHeight);
    }
    ctx.restore();
    return true;
  }

  _loadImage(url) {
    if (this.images.has(url)) return Promise.resolve(this.images.get(url));
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(url, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }
}

const spriteAtlas = new SpriteAtlas();

export function getSpriteAtlas() {
  return spriteAtlas;
}

