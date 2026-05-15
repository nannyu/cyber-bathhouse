/**
 * A* 寻路算法
 * 4 方向移动，Manhattan 距离启发式
 */

/**
 * 在 Tile 地图上计算从起点到终点的最短路径
 * @param {import('./TileMap.js').TileMap} map
 * @param {number} sx - 起点 X
 * @param {number} sy - 起点 Y
 * @param {number} ex - 终点 X
 * @param {number} ey - 终点 Y
 * @returns {Array<{x: number, y: number}>|null} 路径数组（不含起点，含终点），或 null 表示不可达
 */
export function findPath(map, sx, sy, ex, ey) {
    // 起点或终点不可通行
    if (!map.isWalkable(sx, sy) || !map.isWalkable(ex, ey)) {
        return null;
    }

    // 起点就是终点
    if (sx === ex && sy === ey) {
        return [];
    }

    const key = (x, y) => `${x},${y}`;

    // Open set (使用简单数组，MVP 规模小不需要优先队列)
    const openSet = [{ x: sx, y: sy, g: 0, f: manhattan(sx, sy, ex, ey), parent: null }];
    const closedSet = new Set();
    const gScores = new Map();
    gScores.set(key(sx, sy), 0);

    while (openSet.length > 0) {
        // 找 f 值最小的节点
        let bestIdx = 0;
        for (let i = 1; i < openSet.length; i++) {
            if (openSet[i].f < openSet[bestIdx].f) {
                bestIdx = i;
            }
        }
        const current = openSet.splice(bestIdx, 1)[0];
        const currentKey = key(current.x, current.y);

        // 到达终点
        if (current.x === ex && current.y === ey) {
            return reconstructPath(current);
        }

        closedSet.add(currentKey);

        // 遍历邻居
        const neighbors = map.getWalkableNeighbors(current.x, current.y);
        for (const neighbor of neighbors) {
            const nKey = key(neighbor.x, neighbor.y);
            if (closedSet.has(nKey)) continue;

            const tentativeG = current.g + 1;
            const existingG = gScores.get(nKey);

            if (existingG !== undefined && tentativeG >= existingG) continue;

            gScores.set(nKey, tentativeG);
            const f = tentativeG + manhattan(neighbor.x, neighbor.y, ex, ey);

            // 检查是否已在 openSet 中
            const existingIdx = openSet.findIndex(n => n.x === neighbor.x && n.y === neighbor.y);
            if (existingIdx >= 0) {
                openSet[existingIdx].g = tentativeG;
                openSet[existingIdx].f = f;
                openSet[existingIdx].parent = current;
            } else {
                openSet.push({ x: neighbor.x, y: neighbor.y, g: tentativeG, f, parent: current });
            }
        }
    }

    // 无法到达
    return null;
}

/**
 * Manhattan 距离启发式
 */
function manhattan(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/**
 * 从终点节点回溯重建路径
 */
function reconstructPath(endNode) {
    const path = [];
    let node = endNode;
    while (node.parent) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
    }
    return path;
}
