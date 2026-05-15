/**
 * Tile 地图 Canvas 渲染器
 */

const TILE_COLORS = {
    wall: '#4a3728',
    floor: '#d4c4a8',
    door: '#8b6914',
    chair: '#6b4423',
    counter: '#5c3a21',
    boiler_normal: '#8a5c3a',
    boiler_overheating: '#c94040',
    boiler_broken: '#333',
    control_panel: '#4a6a8a',
    toolbox: '#6a6a6a',
};

export class TileMapRenderer {
    constructor() {
        this.map = null;
    }

    setMap(mapData) {
        this.map = mapData;
    }

    render(ctx, facilities) {
        if (!this.map) return;
        const { width, height, tileSize, collision, ground, objects, objectLegend } = this.map;

        // 地面层
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const isWall = collision[y][x] === 1;
                const groundTile = ground[y][x];

                ctx.fillStyle = isWall ? TILE_COLORS.wall : TILE_COLORS.floor;
                if (groundTile === 2) ctx.fillStyle = TILE_COLORS.door; // 门
                ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);

                // 网格线
                ctx.strokeStyle = 'rgba(0,0,0,0.08)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
            }
        }

        // 物件层
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const objId = objects[y][x];
                if (!objId) continue;
                const objType = objectLegend[String(objId)];
                if (!objType || objType === 'floor') continue;

                this._renderObject(ctx, x, y, tileSize, objType, facilities);
            }
        }
    }

    _renderObject(ctx, x, y, size, type, facilities) {
        const px = x * size;
        const py = y * size;
        const pad = 4;

        switch (type) {
            case 'chair':
                ctx.fillStyle = TILE_COLORS.chair;
                ctx.fillRect(px + pad, py + pad, size - pad * 2, size - pad * 2);
                break;
            case 'counter':
                ctx.fillStyle = TILE_COLORS.counter;
                ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
                ctx.fillStyle = '#a67342';
                ctx.fillRect(px + 6, py + 6, size - 12, size - 12);
                break;
            case 'boiler': {
                // 根据设施状态变色
                const facility = facilities?.find(f => f.x === x && f.y === y);
                const status = facility?.state?.status || 'normal';
                ctx.fillStyle = status === 'overheating' ? TILE_COLORS.boiler_overheating
                    : status === 'broken' ? TILE_COLORS.boiler_broken
                        : TILE_COLORS.boiler_normal;
                ctx.fillRect(px + 3, py + 3, size - 6, size - 6);
                // 火焰图标
                ctx.fillStyle = status === 'overheating' ? '#ff6600' : '#ff9933';
                ctx.font = `${size * 0.5}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText('🔥', px + size / 2, py + size * 0.7);
                break;
            }
            case 'control_panel':
                ctx.fillStyle = TILE_COLORS.control_panel;
                ctx.fillRect(px + pad, py + pad, size - pad * 2, size - pad * 2);
                ctx.fillStyle = '#7be5ff';
                ctx.fillRect(px + 8, py + 8, 6, 4);
                ctx.fillRect(px + 16, py + 8, 6, 4);
                break;
            case 'toolbox':
                ctx.fillStyle = TILE_COLORS.toolbox;
                ctx.fillRect(px + pad, py + pad + 4, size - pad * 2, size - pad * 2 - 4);
                ctx.fillStyle = '#aaa';
                ctx.fillRect(px + size / 2 - 4, py + pad, 8, 4);
                break;
        }
    }
}
