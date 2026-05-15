/**
 * v2 游戏主循环 — Tile-based 经营游戏客户端
 */

import { TileMapRenderer } from './TileMapRenderer.js';
import { EntityRenderer } from './EntityRenderer.js';

export class GameV2 {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {Object} options
     * @param {Function} options.onAction - (action) => void 发送动作回调
     */
    constructor(canvas, { onAction }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onAction = onAction;

        this.mapRenderer = new TileMapRenderer();
        this.entityRenderer = null;
        this.state = null;
        this.map = null;
        this.myCharacterId = null;
        this._animId = null;
        this._tick = 0;

        // 点击事件
        canvas.addEventListener('click', (e) => this._handleClick(e));
    }

    /**
     * 设置地图数据
     */
    setMap(mapData) {
        this.map = mapData;
        this.mapRenderer.setMap(mapData);
        this.entityRenderer = new EntityRenderer(mapData.tileSize);

        // 调整 canvas 大小
        this.canvas.width = mapData.width * mapData.tileSize;
        this.canvas.height = mapData.height * mapData.tileSize;
    }

    /**
     * 更新游戏状态（来自服务端广播）
     */
    updateState(state) {
        this.state = state;
    }

    /**
     * 启动渲染循环
     */
    start() {
        const loop = () => {
            this._tick++;
            this._render();
            this._animId = requestAnimationFrame(loop);
        };
        this._animId = requestAnimationFrame(loop);
    }

    /**
     * 停止渲染循环
     */
    stop() {
        if (this._animId) {
            cancelAnimationFrame(this._animId);
            this._animId = null;
        }
    }

    _render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        if (!this.map) return;

        // 渲染地图
        this.mapRenderer.render(ctx, this.state?.facilities);

        if (!this.state) return;

        // 渲染设施覆盖层
        this.entityRenderer.renderFacilityOverlays(ctx, this.state.facilities || []);

        // 渲染角色
        this.entityRenderer.renderCharacters(ctx, this.state.characters || [], this._tick);

        // 渲染 HUD
        this._renderHUD(ctx, w, h);
    }

    _renderHUD(ctx, w, h) {
        if (!this.state) return;

        // 顶部资源栏
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, w, 24);
        ctx.fillStyle = '#fff';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';

        const boiler = this.state.facilities?.find(f => f.type === 'boiler');
        const temp = boiler ? Math.round(boiler.state.temperature) : '?';
        const fuel = boiler ? Math.round(boiler.state.fuel) : '?';
        const status = boiler?.state?.status || '?';

        ctx.fillText(`🔥 温度:${temp}° | ⛽ 燃料:${fuel} | 状态:${status} | Tick:${this.state.tick}`, 8, 16);

        // 任务提示
        const tasks = this.state.tasks || [];
        if (tasks.length > 0) {
            ctx.fillStyle = 'rgba(200,0,0,0.8)';
            ctx.fillRect(0, h - 28, w, 28);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText(`⚠️ ${tasks[0].title} — ${tasks[0].description || ''}`, 8, h - 10);
        }
    }

    _handleClick(e) {
        if (!this.map) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;

        const gridX = Math.floor(canvasX / this.map.tileSize);
        const gridY = Math.floor(canvasY / this.map.tileSize);

        // 检查是否点击了设施（用于 interact）
        const facility = this.state?.facilities?.find(f => f.x === gridX && f.y === gridY);
        if (facility) {
            // 发送 interact（如果相邻）
            this.onAction({ type: 'interact', targetId: facility.id, intent: 'repair' });
            return;
        }

        // 否则发送 move_to
        this.onAction({ type: 'move_to', x: gridX, y: gridY });
    }
}
