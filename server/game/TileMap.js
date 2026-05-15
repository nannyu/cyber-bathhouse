/**
 * Tile 地图数据管理
 * 加载地图 JSON，提供碰撞检测和邻接查询
 */

export class TileMap {
    /**
     * @param {Object} mapData - 地图 JSON 数据
     */
    constructor(mapData) {
        this.width = mapData.width;
        this.height = mapData.height;
        this.tileSize = mapData.tileSize;
        this.collision = mapData.layers.collision;
        this.ground = mapData.layers.ground;
        this.objects = mapData.layers.objects;
        this.facilities = mapData.facilities || [];
        this.zones = mapData.zones || {};
        this.spawns = mapData.spawns || {};
        this.objectLegend = mapData.objectLegend || {};
    }

    /**
     * 检查坐标是否在地图范围内
     */
    inBounds(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    /**
     * 检查指定格子是否可通行
     */
    isWalkable(x, y) {
        if (!this.inBounds(x, y)) return false;
        return this.collision[y][x] === 0;
    }

    /**
     * 检查两个格子是否相邻（4 方向）
     */
    isAdjacent(x1, y1, x2, y2) {
        const dx = Math.abs(x1 - x2);
        const dy = Math.abs(y1 - y2);
        return (dx + dy) === 1;
    }

    /**
     * 获取指定格子的可通行邻居（4 方向）
     * @returns {Array<{x: number, y: number}>}
     */
    getWalkableNeighbors(x, y) {
        const neighbors = [];
        const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]]; // 上下左右
        for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (this.isWalkable(nx, ny)) {
                neighbors.push({ x: nx, y: ny });
            }
        }
        return neighbors;
    }

    /**
     * 获取指定位置的设施
     */
    getFacilityAt(x, y) {
        return this.facilities.find(f => f.x === x && f.y === y) || null;
    }

    /**
     * 获取指定 ID 的设施
     */
    getFacilityById(id) {
        return this.facilities.find(f => f.id === id) || null;
    }

    /**
     * 序列化为客户端可用的数据
     */
    toJSON() {
        return {
            width: this.width,
            height: this.height,
            tileSize: this.tileSize,
            collision: this.collision,
            ground: this.ground,
            objects: this.objects,
            facilities: this.facilities,
            zones: this.zones,
            spawns: this.spawns,
            objectLegend: this.objectLegend,
        };
    }
}
